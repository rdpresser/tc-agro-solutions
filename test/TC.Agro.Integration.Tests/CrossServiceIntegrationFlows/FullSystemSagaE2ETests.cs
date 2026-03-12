using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using TC.Agro.Farm.Application.UseCases.Plots.Create;
using TC.Agro.Farm.Application.UseCases.Properties.Create;
using TC.Agro.Farm.Application.UseCases.Sensors.ChangeStatus;
using TC.Agro.Farm.Application.UseCases.Sensors.Create;
using TC.Agro.Farm.Application.UseCases.Sensors.Deactivate;
using TC.Agro.Identity.Application.UseCases.CreateUser;
using TC.Agro.Identity.Application.UseCases.LoginUser;
using TC.Agro.Integration.Tests.Abstractions;
using TC.Agro.SensorIngest.Application.UseCases.CreateReading;

namespace TC.Agro.Integration.Tests.CrossServiceIntegrationFlows;

public sealed class FullSystemSagaE2ETests : BaseIntegrationTest
{
    public FullSystemSagaE2ETests(CrossServiceIntegrationFixture fixture)
        : base(fixture)
    {
    }

    [Fact]
    public async Task GivenProducerOnboardedAndSensorProvisioned_WhenCriticalReadingFlowsAcrossServices_ThenSagaCompletesWithConsistentState()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var token = Guid.NewGuid().ToString("N")[..8];
        const string password = "Producer@123";

        // Identity: register + login producer
        var createProducerCommand = new CreateUserCommand(
            Name: $"Producer Saga {token}",
            Email: $"producer.saga.{token}@tcagro.test",
            Username: $"producersaga{token}",
            Password: password,
            Role: "Producer");

        using var createProducerResponse = await Fixture.IdentityClient
            .PostAsJsonAsync("/auth/register", createProducerCommand, cancellationToken);

        createProducerResponse.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdProducer = await createProducerResponse.Content
            .ReadFromJsonAsync<CreateUserResponse>(cancellationToken: cancellationToken);

        createdProducer.ShouldNotBeNull();

        using var loginResponse = await Fixture.IdentityClient
            .PostAsJsonAsync("/auth/login", new LoginUserCommand(createProducerCommand.Email, password), cancellationToken);

        loginResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var loginResult = await loginResponse.Content
            .ReadFromJsonAsync<LoginUserResponse>(cancellationToken: cancellationToken);

        loginResult.ShouldNotBeNull();
        loginResult!.JwtToken.ShouldNotBeNullOrWhiteSpace();

        // Cross-service projection: owner snapshots available in all consumers.
        var farmOwner = await Fixture.WaitForFarmOwnerSnapshotAsync(createdProducer!.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);
        var sensorIngestOwner = await Fixture.WaitForSensorIngestOwnerSnapshotAsync(createdProducer.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);
        var analyticsOwner = await Fixture.WaitForAnalyticsOwnerSnapshotAsync(createdProducer.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);

        farmOwner.ShouldNotBeNull();
        sensorIngestOwner.ShouldNotBeNull();
        analyticsOwner.ShouldNotBeNull();

        farmOwner!.IsActive.ShouldBeTrue();
        sensorIngestOwner!.IsActive.ShouldBeTrue();
        analyticsOwner!.IsActive.ShouldBeTrue();

        // Farm: create property + plot + sensor.
        var createPropertyCommand = new CreatePropertyCommand(
            Name: $"Saga Property {token}",
            Address: "Saga Road, km 12",
            City: "Ribeirao Preto",
            State: "SP",
            Country: "Brazil",
            AreaHectares: 100.0,
            Latitude: -21.1767,
            Longitude: -47.8208);

        using var createPropertyResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            "/api/properties",
            createPropertyCommand,
            loginResult.JwtToken,
            cancellationToken);

        createPropertyResponse.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdProperty = await createPropertyResponse.Content
            .ReadFromJsonAsync<CreatePropertyResponse>(cancellationToken: cancellationToken);

        createdProperty.ShouldNotBeNull();

        var cropTypeCatalogId = await Fixture.EnsureFarmSystemCropCatalogAsync("Corn", cancellationToken);

        var createPlotCommand = new CreatePlotCommand(
            PropertyId: createdProperty!.Id,
            Name: $"Saga Plot {token}",
            CropType: "Corn",
            AreaHectares: 30.0,
            Latitude: -21.1775,
            Longitude: -47.8103,
            BoundaryGeoJson: "{\"type\":\"Polygon\",\"coordinates\":[[[-47.811,-21.178],[-47.809,-21.178],[-47.809,-21.176],[-47.811,-21.176],[-47.811,-21.178]]]}",
            PlantingDate: DateTimeOffset.UtcNow.AddDays(-7),
            ExpectedHarvestDate: DateTimeOffset.UtcNow.AddDays(120),
            IrrigationType: "Center Pivot",
            AdditionalNotes: "Full saga E2E flow",
            CropTypeCatalogId: cropTypeCatalogId);

        using var createPlotResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            "/api/plots",
            createPlotCommand,
            loginResult.JwtToken,
            cancellationToken);

        createPlotResponse.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdPlot = await createPlotResponse.Content
            .ReadFromJsonAsync<CreatePlotResponse>(cancellationToken: cancellationToken);

        createdPlot.ShouldNotBeNull();

        var sensorLabel = $"SagaSensor-{token}";
        var createSensorCommand = new CreateSensorCommand(
            PlotId: createdPlot!.Id,
            Type: "Temperature",
            Label: sensorLabel);

        using var createSensorResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            "/api/sensors",
            createSensorCommand,
            loginResult.JwtToken,
            cancellationToken);

        createSensorResponse.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdSensor = await createSensorResponse.Content
            .ReadFromJsonAsync<CreateSensorResponse>(cancellationToken: cancellationToken);

        createdSensor.ShouldNotBeNull();
        createdSensor!.Status.ShouldBe("Active");

        // Cross-service projection: sensor snapshots available and consistent in consumers.
        var sensorIngestSnapshot = await Fixture.WaitForSensorIngestSensorSnapshotAsync(
            createdSensor.Id,
            TimeSpan.FromSeconds(45),
            row => row.IsActive
                && row.OwnerId == createdProducer.Id
                && row.PropertyId == createdProperty.Id
                && row.PlotId == createdPlot.Id
                && row.Label == sensorLabel,
            cancellationToken);

        var analyticsSnapshot = await Fixture.WaitForAnalyticsSensorSnapshotAsync(
            createdSensor.Id,
            TimeSpan.FromSeconds(45),
            row => row.IsActive
                && row.OwnerId == createdProducer.Id
                && row.PropertyId == createdProperty.Id
                && row.PlotId == createdPlot.Id
                && row.Label == sensorLabel,
            cancellationToken);

        sensorIngestSnapshot.ShouldNotBeNull();
        analyticsSnapshot.ShouldNotBeNull();

        // SensorIngest -> Analytics: create critical reading and confirm alert generation.
        var initialAlertCount = await Fixture.GetAnalyticsAlertCountAsync(createdSensor.Id, cancellationToken);

        var criticalReading = new CreateReadingCommand(
            SensorId: createdSensor.Id,
            Timestamp: DateTime.UtcNow,
            Temperature: 55.0,
            Humidity: 60.0,
            SoilMoisture: 50.0,
            Rainfall: 0.0,
            BatteryLevel: 90.0);

        using var createReadingResponse = await SendAuthorizedJsonAsync(
            Fixture.SensorIngestClient,
            HttpMethod.Post,
            "/api/readings",
            criticalReading,
            loginResult.JwtToken,
            cancellationToken);

        createReadingResponse.StatusCode.ShouldBeOneOf(HttpStatusCode.OK, HttpStatusCode.Accepted);

        var readingResult = await createReadingResponse.Content
            .ReadFromJsonAsync<CreateReadingResponse>(cancellationToken: cancellationToken);

        readingResult.ShouldNotBeNull();
        readingResult!.SensorId.ShouldBe(createdSensor.Id);

        var alertCountReached = await Fixture.WaitForAnalyticsAlertCountAsync(
            createdSensor.Id,
            expectedCount: initialAlertCount + 1,
            timeout: TimeSpan.FromSeconds(60),
            cancellationToken);

        alertCountReached.ShouldBeTrue("At least one alert should be created for the critical reading");

        var latestAlert = await Fixture.WaitForAnalyticsAlertAsync(
            createdSensor.Id,
            TimeSpan.FromSeconds(15),
            cancellationToken: cancellationToken);

        latestAlert.ShouldNotBeNull();
        latestAlert!.SensorId.ShouldBe(createdSensor.Id);
        latestAlert.Type.ShouldBe("HighTemperature");
        latestAlert.Message.ShouldNotBeNullOrWhiteSpace();

        var persistedReadings = await Fixture.GetSensorIngestReadingCountAsync(createdSensor.Id, cancellationToken);
        persistedReadings.ShouldBeGreaterThanOrEqualTo(1);

        var outboxDrained = await Fixture.WaitForEmptySensorIngestOutboxAsync(TimeSpan.FromSeconds(10), cancellationToken);
        outboxDrained.ShouldBeTrue("SensorIngest Wolverine outbox should be drained after delivery");

        // Farm lifecycle updates should keep consumer snapshots synchronized.
        var maintenanceReason = "Preventive check in saga";
        var changeStatusCommand = new ChangeSensorStatusCommand(
            SensorId: createdSensor.Id,
            NewStatus: "Maintenance",
            Reason: maintenanceReason);

        using var changeStatusResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Put,
            $"/api/sensors/{createdSensor.Id}/status-change",
            changeStatusCommand,
            loginResult.JwtToken,
            cancellationToken);

        changeStatusResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var sensorIngestMaintenanceSnapshot = await Fixture.WaitForSensorIngestSensorSnapshotAsync(
            createdSensor.Id,
            TimeSpan.FromSeconds(45),
            row => row.Status == "Maintenance" && row.StatusChangeReason == maintenanceReason,
            cancellationToken);

        var analyticsMaintenanceSnapshot = await Fixture.WaitForAnalyticsSensorSnapshotAsync(
            createdSensor.Id,
            TimeSpan.FromSeconds(45),
            row => row.Status == "Maintenance" && row.StatusChangeReason == maintenanceReason,
            cancellationToken);

        sensorIngestMaintenanceSnapshot.ShouldNotBeNull();
        analyticsMaintenanceSnapshot.ShouldNotBeNull();

        var deactivateCommand = new DeactivateSensorCommand(
            SensorId: createdSensor.Id,
            Reason: "Saga decommission");

        using var deactivateResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Delete,
            $"/api/sensors/{createdSensor.Id}",
            deactivateCommand,
            loginResult.JwtToken,
            cancellationToken);

        deactivateResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var sensorIngestInactiveSnapshot = await Fixture.WaitForSensorIngestSensorSnapshotAsync(
            createdSensor.Id,
            TimeSpan.FromSeconds(45),
            row => !row.IsActive,
            cancellationToken);

        var analyticsInactiveSnapshot = await Fixture.WaitForAnalyticsSensorSnapshotAsync(
            createdSensor.Id,
            TimeSpan.FromSeconds(45),
            row => !row.IsActive,
            cancellationToken);

        sensorIngestInactiveSnapshot.ShouldNotBeNull();
        analyticsInactiveSnapshot.ShouldNotBeNull();
        sensorIngestInactiveSnapshot!.IsActive.ShouldBeFalse();
        analyticsInactiveSnapshot!.IsActive.ShouldBeFalse();
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
}
