using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using TC.Agro.Farm.Application.UseCases.Plots.Create;
using TC.Agro.Farm.Application.UseCases.Properties.Create;
using TC.Agro.Farm.Application.UseCases.Sensors.Create;
using TC.Agro.Identity.Application.UseCases.CreateUser;
using TC.Agro.Identity.Application.UseCases.LoginUser;
using TC.Agro.Integration.Tests.Abstractions;
using TC.Agro.SensorIngest.Application.UseCases.CreateReading;

namespace TC.Agro.Integration.Tests.CrossServiceIntegrationFlows;

public sealed class SensorIngestToCrossServiceAnalyticsAlertFlowTests : BaseIntegrationTest
{
    public SensorIngestToCrossServiceAnalyticsAlertFlowTests(CrossServiceIntegrationFixture fixture)
        : base(fixture)
    {
    }

    [Fact]
    public async Task GivenCriticalReadingInSensorIngest_WhenEventIsPublished_ThenAnalyticsCreatesAlert()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var context = await ProvisionSensorAsync(cancellationToken);

        var initialAlertCount = await Fixture.GetAnalyticsAlertCountAsync(context.SensorId, cancellationToken);
        initialAlertCount.ShouldBe(0);

        var criticalReading = new CreateReadingCommand(
            SensorId: context.SensorId,
            Timestamp: DateTime.UtcNow,
            Temperature: 55.0,
            Humidity: 22.0,
            SoilMoisture: 8.0,
            Rainfall: 0.0,
            BatteryLevel: 10.0);

        using var createReadingResponse = await SendAuthorizedJsonAsync(
            Fixture.SensorIngestClient,
            HttpMethod.Post,
            "/api/readings",
            criticalReading,
            context.JwtToken,
            cancellationToken);

        createReadingResponse.StatusCode.ShouldBeOneOf(HttpStatusCode.OK, HttpStatusCode.Accepted);

        var readingResult = await createReadingResponse.Content
            .ReadFromJsonAsync<CreateReadingResponse>(cancellationToken: cancellationToken);

        readingResult.ShouldNotBeNull();
        readingResult!.SensorId.ShouldBe(context.SensorId);

        var alert = await Fixture.WaitForAnalyticsAlertAsync(
            context.SensorId,
            TimeSpan.FromSeconds(45),
            cancellationToken: cancellationToken);

        alert.ShouldNotBeNull();
        alert!.SensorId.ShouldBe(context.SensorId);
        alert.Type.ShouldBeOneOf("HighTemperature", "LowSoilMoisture", "LowBattery");
        alert.Message.ShouldNotBeNullOrWhiteSpace();

        var finalAlertCount = await Fixture.GetAnalyticsAlertCountAsync(context.SensorId, cancellationToken);
        finalAlertCount.ShouldBeGreaterThan(initialAlertCount);
    }

    [Fact]
    public async Task GivenHealthyReadingInSensorIngest_WhenEventIsPublished_ThenAnalyticsDoesNotCreateAlert()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var context = await ProvisionSensorAsync(cancellationToken);

        var initialAlertCount = await Fixture.GetAnalyticsAlertCountAsync(context.SensorId, cancellationToken);
        initialAlertCount.ShouldBe(0);

        var healthyReading = new CreateReadingCommand(
            SensorId: context.SensorId,
            Timestamp: DateTime.UtcNow,
            Temperature: 24.5,
            Humidity: 60.0,
            SoilMoisture: 55.0,
            Rainfall: 1.2,
            BatteryLevel: 92.0);

        using var createReadingResponse = await SendAuthorizedJsonAsync(
            Fixture.SensorIngestClient,
            HttpMethod.Post,
            "/api/readings",
            healthyReading,
            context.JwtToken,
            cancellationToken);

        createReadingResponse.StatusCode.ShouldBeOneOf(HttpStatusCode.OK, HttpStatusCode.Accepted);

        var unexpectedAlert = await Fixture.WaitForAnalyticsAlertAsync(
            context.SensorId,
            TimeSpan.FromSeconds(12),
            cancellationToken: cancellationToken);

        unexpectedAlert.ShouldBeNull();

        var finalAlertCount = await Fixture.GetAnalyticsAlertCountAsync(context.SensorId, cancellationToken);
        finalAlertCount.ShouldBe(initialAlertCount);
    }

    private async Task<ProvisionedSensorContext> ProvisionSensorAsync(CancellationToken cancellationToken)
    {
        var token = Guid.NewGuid().ToString("N")[..8];
        var password = "Producer@123";

        var createProducerCommand = new CreateUserCommand(
            Name: $"Producer {token}",
            Email: $"producer.alerts.{token}@tcagro.test",
            Username: $"produceralerts{token}",
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

        await Fixture.WaitForSensorIngestOwnerSnapshotAsync(createdProducer!.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);
        await Fixture.WaitForAnalyticsOwnerSnapshotAsync(createdProducer.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);

        var createPropertyCommand = new CreatePropertyCommand(
            Name: $"Property Alerts {token}",
            Address: "Road Alerts, km 01",
            City: "Campinas",
            State: "SP",
            Country: "Brazil",
            AreaHectares: 80.0,
            Latitude: -22.90,
            Longitude: -47.06);

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

        var createPlotCommand = new CreatePlotCommand(
            PropertyId: createdProperty!.Id,
            Name: $"Plot Alerts {token}",
            CropType: "Corn",
            AreaHectares: 20.0,
            Latitude: -22.91,
            Longitude: -47.07,
            BoundaryGeoJson: "{\"type\":\"Polygon\",\"coordinates\":[[[-47.071,-22.911],[-47.069,-22.911],[-47.069,-22.909],[-47.071,-22.909],[-47.071,-22.911]]]}",
            PlantingDate: DateTimeOffset.UtcNow.AddDays(-5),
            ExpectedHarvestDate: DateTimeOffset.UtcNow.AddDays(100),
            IrrigationType: "Center Pivot",
            AdditionalNotes: "Provisioned for alert integration tests");

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

        var createSensorCommand = new CreateSensorCommand(
            PlotId: createdPlot!.Id,
            Type: "Temperature",
            Label: $"Alert-Sensor-{token}");

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

        await Fixture.WaitForSensorIngestSensorSnapshotAsync(createdSensor!.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);
        await Fixture.WaitForAnalyticsSensorSnapshotAsync(createdSensor.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);

        return new ProvisionedSensorContext(createdSensor.Id, loginResult.JwtToken);
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

    private sealed record ProvisionedSensorContext(Guid SensorId, string JwtToken);
}
