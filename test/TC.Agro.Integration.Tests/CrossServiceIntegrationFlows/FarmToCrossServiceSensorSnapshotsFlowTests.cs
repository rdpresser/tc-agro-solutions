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

namespace TC.Agro.Integration.Tests.CrossServiceIntegrationFlows;

public sealed class FarmToCrossServiceSensorSnapshotsFlowTests : BaseIntegrationTest
{
    public FarmToCrossServiceSensorSnapshotsFlowTests(CrossServiceIntegrationFixture fixture)
        : base(fixture)
    {
    }

    [Fact]
    public async Task GivenSensorLifecycleInFarm_WhenEventsArePublished_ThenSensorSnapshotsAreProjectedAndUpdatedInConsumers()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var producer = await CreateProducerContextAsync(cancellationToken);

        var createPropertyCommand = new CreatePropertyCommand(
            Name: $"Integration Property {producer.Token}",
            Address: "Road 01, km 10",
            City: "Ribeirao Preto",
            State: "SP",
            Country: "Brazil",
            AreaHectares: 120.5,
            Latitude: -21.1767,
            Longitude: -47.8208);

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

        var createPlotCommand = new CreatePlotCommand(
            PropertyId: createdProperty!.Id,
            Name: $"Integration Plot {producer.Token}",
            CropType: "Soy",
            AreaHectares: 45.2,
            Latitude: -21.1775,
            Longitude: -47.8103,
            BoundaryGeoJson: "{\"type\":\"Polygon\",\"coordinates\":[[[-47.811,-21.178],[-47.809,-21.178],[-47.809,-21.176],[-47.811,-21.176],[-47.811,-21.178]]]}",
            PlantingDate: DateTimeOffset.UtcNow.AddDays(-3),
            ExpectedHarvestDate: DateTimeOffset.UtcNow.AddDays(90),
            IrrigationType: "Center Pivot",
            AdditionalNotes: "Integration E2E test plot");

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

        var sensorLabel = $"Sensor-{producer.Token}";
        var createSensorCommand = new CreateSensorCommand(
            PlotId: createdPlot!.Id,
            Type: "Temperature",
            Label: sensorLabel);

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
        createdSensor!.Status.ShouldBe("Active");

        var sensorIngestSnapshot = await Fixture.WaitForSensorIngestSensorSnapshotAsync(
            createdSensor.Id,
            TimeSpan.FromSeconds(45),
            cancellationToken: cancellationToken);

        var analyticsSnapshot = await Fixture.WaitForAnalyticsSensorSnapshotAsync(
            createdSensor.Id,
            TimeSpan.FromSeconds(45),
            cancellationToken: cancellationToken);

        sensorIngestSnapshot.ShouldNotBeNull();
        analyticsSnapshot.ShouldNotBeNull();

        sensorIngestSnapshot!.IsActive.ShouldBeTrue();
        sensorIngestSnapshot.Status.ShouldBe("Active");
        sensorIngestSnapshot.Label.ShouldBe(sensorLabel);

        analyticsSnapshot!.IsActive.ShouldBeTrue();
        analyticsSnapshot.Status.ShouldBe("Active");
        analyticsSnapshot.Label.ShouldBe(sensorLabel);

        var statusReason = "Scheduled preventive maintenance";
        var changeStatusCommand = new ChangeSensorStatusCommand(
            SensorId: createdSensor.Id,
            NewStatus: "Maintenance",
            Reason: statusReason);

        using var changeStatusResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Put,
            $"/api/sensors/{createdSensor.Id}/status-change",
            changeStatusCommand,
            producer.JwtToken,
            cancellationToken);

        changeStatusResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var sensorIngestUpdatedSnapshot = await Fixture.WaitForSensorIngestSensorSnapshotAsync(
            createdSensor.Id,
            TimeSpan.FromSeconds(45),
            row => row.Status == "Maintenance" && row.StatusChangeReason == statusReason,
            cancellationToken);

        var analyticsUpdatedSnapshot = await Fixture.WaitForAnalyticsSensorSnapshotAsync(
            createdSensor.Id,
            TimeSpan.FromSeconds(45),
            row => row.Status == "Maintenance" && row.StatusChangeReason == statusReason,
            cancellationToken);

        sensorIngestUpdatedSnapshot.ShouldNotBeNull();
        analyticsUpdatedSnapshot.ShouldNotBeNull();

        sensorIngestUpdatedSnapshot!.Status.ShouldBe("Maintenance");
        sensorIngestUpdatedSnapshot.StatusChangeReason.ShouldBe(statusReason);

        analyticsUpdatedSnapshot!.Status.ShouldBe("Maintenance");
        analyticsUpdatedSnapshot.StatusChangeReason.ShouldBe(statusReason);

        var deactivateCommand = new DeactivateSensorCommand(
            SensorId: createdSensor.Id,
            Reason: "End of lifecycle");

        using var deactivateResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Delete,
            $"/api/sensors/{createdSensor.Id}",
            deactivateCommand,
            producer.JwtToken,
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

    private async Task<ProducerContext> CreateProducerContextAsync(CancellationToken cancellationToken)
    {
        var token = Guid.NewGuid().ToString("N")[..8];
        var password = "Producer@123";

        var createProducerCommand = new CreateUserCommand(
            Name: $"Producer {token}",
            Email: $"producer.{token}@tcagro.test",
            Username: $"producer{token}",
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

        await Fixture.WaitForFarmOwnerSnapshotAsync(createdProducer!.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);
        await Fixture.WaitForSensorIngestOwnerSnapshotAsync(createdProducer.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);
        await Fixture.WaitForAnalyticsOwnerSnapshotAsync(createdProducer.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);

        return new ProducerContext(createdProducer.Id, loginResult.JwtToken, token);
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
