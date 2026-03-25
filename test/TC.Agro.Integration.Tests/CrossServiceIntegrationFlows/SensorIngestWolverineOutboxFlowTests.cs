using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using TC.Agro.Farm.Application.UseCases.Plots.Create;
using TC.Agro.Farm.Application.UseCases.Properties.Create;
using TC.Agro.Farm.Application.UseCases.Sensors.Create;
using TC.Agro.Identity.Application.UseCases.CreateUser;
using TC.Agro.Identity.Application.UseCases.LoginUser;
using TC.Agro.Integration.Tests.Abstractions;
using TC.Agro.SensorIngest.Application.UseCases.CreateBatchReadings;
using TC.Agro.SensorIngest.Application.UseCases.CreateReading;

namespace TC.Agro.Integration.Tests.CrossServiceIntegrationFlows;

/// <summary>
/// E2E tests verifying Wolverine transactional outbox and reliable delivery guarantees.
///
/// Key behaviors exercised:
/// - Readings persisted and integration events placed in the Wolverine outbox atomically.
/// - All outbox messages are delivered to Analytics; no events are silently dropped.
/// - After delivery, the wolverine.wolverine_outgoing_envelopes table is drained (no stuck messages).
/// - Multiple readings for the same sensor each produce independent events and alerts,
///   confirming the system does not over-deduplicate at the data level.
/// </summary>
[Collection(nameof(CrossServiceIntegrationTestCollection))]
public sealed class SensorIngestWolverineOutboxFlowTests : BaseIntegrationTest
{
    public SensorIngestWolverineOutboxFlowTests(CrossServiceIntegrationFixture fixture)
        : base(fixture)
    {
    }

    [Fact]
    public async Task GivenMultipleCriticalReadings_WhenPublishedViaWolverineOutbox_ThenAllEventsReachAnalyticsAndOutboxIsDrained()
    {
        var cancellationToken = TestContext.Current.CancellationToken;

        // 1. Provision a sensor so readings have a valid sensor_id in SensorIngest.
        var context = await ProvisionSensorAsync(cancellationToken);

        var baselineAlertCount = await Fixture.GetAnalyticsAlertCountAsync(context.SensorId, cancellationToken);

        // 2. POST three critical readings independently.
        //    Each POST flows through: HTTP -> SensorIngest handler -> DB persist + Wolverine outbox write (atomic)
        //    -> Wolverine background delivers event to RabbitMQ -> Analytics consumes it -> alert created.
        const int readingCount = 3;
        for (var i = 0; i < readingCount; i++)
        {
            using var readingResponse = await SendAuthorizedJsonAsync(
                Fixture.SensorIngestClient,
                HttpMethod.Post,
                "/api/readings",
                new CreateReadingCommand(
                    SensorId: context.SensorId,
                    Timestamp: DateTime.UtcNow.AddSeconds(-i),
                    Temperature: 55.0,
                    Humidity: 60.0,
                    SoilMoisture: 50.0,
                    Rainfall: 0.0,
                    BatteryLevel: 90.0),
                context.JwtToken,
                cancellationToken);

            readingResponse.StatusCode.ShouldBeOneOf(
                HttpStatusCode.OK, HttpStatusCode.Accepted, HttpStatusCode.Created);
        }

        // 3. Verify all readings were persisted atomically with the outbox writes.
        var persistedReadings = await Fixture.GetSensorIngestReadingCountAsync(context.SensorId, cancellationToken);
        persistedReadings.ShouldBeGreaterThanOrEqualTo(readingCount,
            $"All {readingCount} readings should be persisted in sensor_readings");

        // 4. Wait for all alerts to arrive in Analytics using count-based polling to ensure
        //    we do not assert before all 3 outbox events have been delivered.
        var allAlertsArrived = await Fixture.WaitForAnalyticsAlertCountAsync(
            context.SensorId,
            expectedCount: baselineAlertCount + readingCount,
            timeout: TimeSpan.FromSeconds(60),
            cancellationToken);

        allAlertsArrived.ShouldBeTrue(
            $"All {readingCount} alerts should have arrived in Analytics within the timeout");

        var finalAlertCount = await Fixture.GetAnalyticsAlertCountAsync(context.SensorId, cancellationToken);
        finalAlertCount.ShouldBe(baselineAlertCount + readingCount,
            $"Each critical reading must produce exactly one alert (no duplicates, no lost events)");

        // 5. Verify the Wolverine outbox is drained.
        //    By the time Analytics has confirmed all alerts, delivery is already complete,
        //    so wolverine.wolverine_outgoing_envelopes should already be empty.
        var pendingOutbox = await Fixture.GetSensorIngestOutboxPendingCountAsync(cancellationToken);
        pendingOutbox.ShouldBe(0,
            "Wolverine outbox must be fully drained after all integration events have been delivered to Analytics");
    }

    [Fact]
    public async Task GivenBatchReadingWithMultipleSensors_WhenEachEventPublishedViaOutbox_ThenEventsAreDeliveredExactlyOnce()
    {
        var cancellationToken = TestContext.Current.CancellationToken;

        // Provision two sensors to verify multi-sensor batch outbox delivery.
        var context1 = await ProvisionSensorAsync(cancellationToken);
        var context2 = await ProvisionSensorAsync(cancellationToken);

        var baseline1 = await Fixture.GetAnalyticsAlertCountAsync(context1.SensorId, cancellationToken);
        var baseline2 = await Fixture.GetAnalyticsAlertCountAsync(context2.SensorId, cancellationToken);

        // POST a batch: one critical reading per sensor.
        var batchCommand = new CreateBatchReadingsCommand(
        [
            new SensorReadingInput(
                SensorId: context1.SensorId,
                Timestamp: DateTime.UtcNow,
                Temperature: 52.0,
                Humidity: 60.0,
                SoilMoisture: 50.0,
                Rainfall: 0.0,
                BatteryLevel: 90.0),
            new SensorReadingInput(
                SensorId: context2.SensorId,
                Timestamp: DateTime.UtcNow,
                Temperature: 52.0,
                Humidity: 60.0,
                SoilMoisture: 50.0,
                Rainfall: 0.0,
                BatteryLevel: 90.0)
        ]);

        using var batchResponse = await SendAuthorizedJsonAsync(
            Fixture.SensorIngestClient,
            HttpMethod.Post,
            "/api/readings/batch",
            batchCommand,
            context1.JwtToken,
            cancellationToken);

        batchResponse.StatusCode.ShouldBeOneOf(HttpStatusCode.OK, HttpStatusCode.Accepted);

        // Both events must reach Analytics via the Wolverine outbox -- one alert per sensor.
        var sensor1AlertArrived = await Fixture.WaitForAnalyticsAlertCountAsync(
            context1.SensorId,
            expectedCount: baseline1 + 1,
            timeout: TimeSpan.FromSeconds(45),
            cancellationToken);

        var sensor2AlertArrived = await Fixture.WaitForAnalyticsAlertCountAsync(
            context2.SensorId,
            expectedCount: baseline2 + 1,
            timeout: TimeSpan.FromSeconds(45),
            cancellationToken);

        sensor1AlertArrived.ShouldBeTrue("Alert for sensor 1 should be delivered via outbox to Analytics");
        sensor2AlertArrived.ShouldBeTrue("Alert for sensor 2 should be delivered via outbox to Analytics");

        var count1 = await Fixture.GetAnalyticsAlertCountAsync(context1.SensorId, cancellationToken);
        var count2 = await Fixture.GetAnalyticsAlertCountAsync(context2.SensorId, cancellationToken);

        count1.ShouldBe(baseline1 + 1, "Exactly one alert per sensor, no duplicate deliveries from the outbox");
        count2.ShouldBe(baseline2 + 1, "Exactly one alert per sensor, no duplicate deliveries from the outbox");

        // Outbox must be drained after both events were delivered.
        var outboxDrained = await Fixture.WaitForEmptySensorIngestOutboxAsync(
            TimeSpan.FromSeconds(10),
            cancellationToken);

        outboxDrained.ShouldBeTrue(
            "Wolverine outbox should be drained after all batch integration events have been delivered");
    }

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    private async Task<ProvisionedSensorContext> ProvisionSensorAsync(CancellationToken cancellationToken)
    {
        var token = Guid.NewGuid().ToString("N")[..8];
        const string password = "Producer@123";

        var createCommand = new CreateUserCommand(
            Name: $"Producer {token}",
            Email: $"producer.outbox.{token}@tcagro.test",
            Username: $"produceroutbox{token}",
            Password: password,
            Role: "Producer");

        using var createUserResponse = await Fixture.IdentityClient
            .PostAsJsonAsync("/auth/register", createCommand, cancellationToken);

        createUserResponse.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdUser = await createUserResponse.Content
            .ReadFromJsonAsync<CreateUserResponse>(cancellationToken: cancellationToken);

        createdUser.ShouldNotBeNull();

        var loginCommand = new LoginUserCommand(createCommand.Email, password);

        using var loginResponse = await Fixture.IdentityClient
            .PostAsJsonAsync("/auth/login", loginCommand, cancellationToken);

        loginResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var loginResult = await loginResponse.Content
            .ReadFromJsonAsync<LoginUserResponse>(cancellationToken: cancellationToken);

        loginResult.ShouldNotBeNull();
        loginResult!.JwtToken.ShouldNotBeNullOrWhiteSpace();

        await Fixture.WaitForFarmOwnerSnapshotAsync(createdUser!.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);
        await Fixture.WaitForSensorIngestOwnerSnapshotAsync(createdUser!.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);
        await Fixture.WaitForAnalyticsOwnerSnapshotAsync(createdUser.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);

        var cropTypeCatalogId = await Fixture.EnsureFarmSystemCropCatalogAsync("Rice", cancellationToken);

        var createPropertyCommand = new CreatePropertyCommand(
            Name: $"Outbox Property {token}",
            Address: "Outbox Road, km 1",
            City: "Porto Alegre",
            State: "RS",
            Country: "Brazil",
            AreaHectares: 30.0,
            Latitude: -30.01,
            Longitude: -51.22);

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
            Name: $"Outbox Plot {token}",
            CropType: "Rice",
            AreaHectares: 8.0,
            Latitude: -30.02,
            Longitude: -51.23,
            BoundaryGeoJson: "{\"type\":\"Polygon\",\"coordinates\":[[[-51.231,-30.021],[-51.229,-30.021],[-51.229,-30.019],[-51.231,-30.019],[-51.231,-30.021]]]}",
            PlantingDate: DateTimeOffset.UtcNow.AddDays(-10),
            ExpectedHarvestDate: DateTimeOffset.UtcNow.AddDays(80),
            IrrigationType: "Center Pivot",
            AdditionalNotes: "Wolverine outbox E2E test",
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

        var createSensorCommand = new CreateSensorCommand(
            PlotId: createdPlot!.Id,
            Type: "Temperature",
            Label: $"OutboxSensor-{token}");

        using var createSensorResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            "/api/sensors",
            createSensorCommand,
            loginResult.JwtToken,
            cancellationToken);

        var createSensorBody = await createSensorResponse.Content.ReadAsStringAsync(cancellationToken);
        createSensorResponse.StatusCode.ShouldBe(HttpStatusCode.Created, createSensorBody);

        var createdSensor = await createSensorResponse.Content
            .ReadFromJsonAsync<CreateSensorResponse>(cancellationToken: cancellationToken);

        createdSensor.ShouldNotBeNull();

        await Fixture.WaitForSensorIngestSensorSnapshotAsync(
            createdSensor!.Id,
            TimeSpan.FromSeconds(45),
            cancellationToken: cancellationToken);

        await Fixture.WaitForAnalyticsSensorSnapshotAsync(
            createdSensor.Id,
            TimeSpan.FromSeconds(45),
            cancellationToken: cancellationToken);

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