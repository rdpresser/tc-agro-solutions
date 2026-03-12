using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using TC.Agro.Farm.Application.UseCases.Plots.Create;
using TC.Agro.Farm.Application.UseCases.Properties.Create;
using TC.Agro.Farm.Application.UseCases.Sensors.Create;
using TC.Agro.Identity.Application.UseCases.CreateUser;
using TC.Agro.Identity.Application.UseCases.LoginUser;
using TC.Agro.Integration.Tests.Abstractions;

namespace TC.Agro.Integration.Tests.CrossServiceIntegrationFlows;

/// <summary>
/// E2E tests for the SimulatedSensorReadingsJob Quartz background job.
/// Uses a dedicated fixture with the job enabled at a 5-second interval so we can
/// observe readings appearing in the DB without long waits.
/// </summary>
[Collection(nameof(SensorReadingsJobTestCollection))]
public sealed class SensorIngestSimulatedReadingsJobFlowTests : IAsyncLifetime
{
    private SensorReadingsJobIntegrationFixture Fixture { get; }

    public SensorIngestSimulatedReadingsJobFlowTests(SensorReadingsJobIntegrationFixture fixture)
    {
        Fixture = fixture;
    }

    public ValueTask InitializeAsync()
        => new(Fixture.ResetStateAsync(TestContext.Current.CancellationToken));

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    [Fact]
    public async Task GivenActiveSensor_WhenJobFires_ThenSimulatedReadingsAreGeneratedAndPersistedForThatSensor()
    {
        var cancellationToken = TestContext.Current.CancellationToken;

        // 1. Provision user → property → plot (no lat/lon → job uses fully simulated weather fallback) → sensor
        var producer = await CreateProducerContextAsync(cancellationToken);
        var (_, sensor) = await CreatePropertyAndSensorAsync(producer, cancellationToken);

        // 2. Wait for the sensor snapshot to propagate to SensorIngest.
        //    The Quartz job reads from ISensorSnapshotStore, which is backed by the sensor_snapshots table.
        //    Without this snapshot, GetAllActiveAsync() returns empty and the job skips generation.
        var snapshot = await Fixture.WaitForSensorIngestSensorSnapshotAsync(
            sensor.Id,
            TimeSpan.FromSeconds(45),
            cancellationToken: cancellationToken);

        snapshot.ShouldNotBeNull("Sensor snapshot must be propagated to SensorIngest before the job fires");
        snapshot!.IsActive.ShouldBeTrue("Sensor snapshot must be active for the job to pick it up");

        // 3. Wait for the job to fire (interval = 5s) and persist at least one reading.
        //    Timeout = 45s covers: up to 5s until next fire + processing time + DB write.
        var hasReading = await Fixture.WaitForSensorReadingsAsync(
            sensor.Id,
            minCount: 1,
            TimeSpan.FromSeconds(45),
            cancellationToken);

        hasReading.ShouldBeTrue(
            "SimulatedSensorReadingsJob should have generated and persisted at least one reading for the active sensor");

        // 4. Assert the reading count is at least 1 (the job may have fired multiple times).
        var readingCount = await Fixture.GetSensorIngestReadingCountAsync(sensor.Id, cancellationToken);
        readingCount.ShouldBeGreaterThanOrEqualTo(1,
            $"Expected at least 1 persisted reading for sensor {sensor.Id}, but found {readingCount}");
    }

    [Fact]
    public async Task GivenNoActiveSensors_WhenJobFires_ThenNoReadingsAreGeneratedAndOutboxRemainsEmpty()
    {
        var cancellationToken = TestContext.Current.CancellationToken;

        // No sensors provisioned - WhenJobFires logs "No active sensors found. Skipping".
        // Wait for two job cycles (5s × 2 = 10s) then assert nothing was written.
        await Task.Delay(TimeSpan.FromSeconds(12), cancellationToken);

        // An arbitrary non-existent sensor ID: no readings should exist.
        var phantomSensorId = Guid.NewGuid();
        var readingCount = await Fixture.GetSensorIngestReadingCountAsync(phantomSensorId, cancellationToken);
        var outboxEmpty = await Fixture.WaitForEmptySensorIngestOutboxAsync(
            TimeSpan.FromSeconds(5),
            cancellationToken);

        readingCount.ShouldBe(0,
            "No readings should be generated when there are no active sensors in the snapshot store");
        outboxEmpty.ShouldBeTrue(
            "Outbox should remain empty when no active sensors are available for the simulated readings job");
    }

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    private async Task<ProducerContext> CreateProducerContextAsync(CancellationToken cancellationToken)
    {
        var token = Guid.NewGuid().ToString("N")[..8];
        const string password = "Producer@123";

        var createProducerCommand = new CreateUserCommand(
            Name: $"Producer {token}",
            Email: $"producer.job.{token}@tcagro.test",
            Username: $"producerjob{token}",
            Password: password,
            Role: "Producer");

        using var createProducerResponse = await Fixture.IdentityClient
            .PostAsJsonAsync("/auth/register", createProducerCommand, cancellationToken);

        createProducerResponse.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdProducer = await createProducerResponse.Content
            .ReadFromJsonAsync<CreateUserResponse>(cancellationToken: cancellationToken);

        createdProducer.ShouldNotBeNull();

        var loginCommand = new LoginUserCommand(createProducerCommand.Email, password);

        using var loginResponse = await Fixture.IdentityClient
            .PostAsJsonAsync("/auth/login", loginCommand, cancellationToken);

        loginResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var loginResult = await loginResponse.Content
            .ReadFromJsonAsync<LoginUserResponse>(cancellationToken: cancellationToken);

        loginResult.ShouldNotBeNull();
        loginResult!.JwtToken.ShouldNotBeNullOrWhiteSpace();

        // Wait for Farm snapshot before creating Farm entities and for SensorIngest snapshot so
        // the job can attribute generated readings to this owner.
        await Fixture.WaitForFarmOwnerSnapshotAsync(
            createdProducer!.Id,
            TimeSpan.FromSeconds(45),
            cancellationToken: cancellationToken);

        await Fixture.WaitForSensorIngestOwnerSnapshotAsync(
            createdProducer.Id,
            TimeSpan.FromSeconds(45),
            cancellationToken: cancellationToken);

        return new ProducerContext(createdProducer.Id, loginResult.JwtToken, token);
    }

    private async Task<(CreatePropertyResponse Property, CreateSensorResponse Sensor)> CreatePropertyAndSensorAsync(
        ProducerContext producer,
        CancellationToken cancellationToken)
    {
        var cropTypeCatalogId = await Fixture.EnsureFarmSystemCropCatalogAsync("Wheat", cancellationToken);

        var createPropertyCommand = new CreatePropertyCommand(
            Name: $"Job Test Property {producer.Token}",
            Address: "Job Test Road, km 1",
            City: "Sao Paulo",
            State: "SP",
            Country: "Brazil",
            AreaHectares: 50.0,
            // No coordinates at property level — coordinates matter at plot level for weather API.
            Latitude: null,
            Longitude: null);

        using var createPropertyResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            "/api/properties",
            createPropertyCommand,
            producer.JwtToken,
            cancellationToken);

        createPropertyResponse.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdProperty = await createPropertyResponse.Content
            .ReadFromJsonAsync<CreatePropertyResponse>(cancellationToken: cancellationToken);

        createdProperty.ShouldNotBeNull();

        // No lat/lon on the plot → SensorRegisteredIntegrationEvent.PlotLatitude = null
        // → SimulatedSensorReadingsJob.BuildWeatherLocation returns null
        // → Job skips Open-Meteo API and uses fully-simulated Bogus weather data.
        var createPlotCommand = new CreatePlotCommand(
            PropertyId: createdProperty!.Id,
            Name: $"Job Test Plot {producer.Token}",
            CropType: "Wheat",
            AreaHectares: 10.0,
            Latitude: null,
            Longitude: null,
            BoundaryGeoJson: null,
            PlantingDate: DateTimeOffset.UtcNow.AddDays(-7),
            ExpectedHarvestDate: DateTimeOffset.UtcNow.AddDays(120),
            IrrigationType: "Drip Irrigation",
            AdditionalNotes: "Simulated job E2E test",
            CropTypeCatalogId: cropTypeCatalogId);

        using var createPlotResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            "/api/plots",
            createPlotCommand,
            producer.JwtToken,
            cancellationToken);

        createPlotResponse.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdPlot = await createPlotResponse.Content
            .ReadFromJsonAsync<CreatePlotResponse>(cancellationToken: cancellationToken);

        createdPlot.ShouldNotBeNull();

        var createSensorCommand = new CreateSensorCommand(
            PlotId: createdPlot!.Id,
            Type: "SoilMoisture",
            Label: $"JobSensor-{producer.Token}");

        using var createSensorResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            "/api/sensors",
            createSensorCommand,
            producer.JwtToken,
            cancellationToken);

        createSensorResponse.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdSensor = await createSensorResponse.Content
            .ReadFromJsonAsync<CreateSensorResponse>(cancellationToken: cancellationToken);

        createdSensor.ShouldNotBeNull();

        return (createdProperty!, createdSensor!);
    }

    private static async Task<HttpResponseMessage> SendAuthorizedJsonAsync<TPayload>(
        HttpClient client,
        HttpMethod method,
        string route,
        TPayload payload,
        string jwtToken,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, route)
        {
            Content = JsonContent.Create(payload)
        };

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwtToken);

        return await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    private sealed record ProducerContext(Guid UserId, string JwtToken, string Token);
}
