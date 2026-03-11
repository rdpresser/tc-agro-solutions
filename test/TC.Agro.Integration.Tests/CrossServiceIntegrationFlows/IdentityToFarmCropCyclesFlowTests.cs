using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using TC.Agro.Farm.Application.UseCases.CropCycles.Complete;
using TC.Agro.Farm.Application.UseCases.CropCycles.Start;
using TC.Agro.Farm.Application.UseCases.CropCycles.Transition;
using TC.Agro.Farm.Application.UseCases.Plots.Create;
using TC.Agro.Farm.Application.UseCases.Properties.Create;
using TC.Agro.Farm.Application.UseCases.Properties.Update;
using TC.Agro.Identity.Application.UseCases.CreateUser;
using TC.Agro.Identity.Application.UseCases.LoginUser;
using TC.Agro.Integration.Tests.Abstractions;

namespace TC.Agro.Integration.Tests.CrossServiceIntegrationFlows;

public sealed class IdentityToFarmCropCyclesFlowTests : BaseIntegrationTest
{
    public IdentityToFarmCropCyclesFlowTests(CrossServiceIntegrationFixture fixture)
        : base(fixture)
    {
    }

    [Fact]
    public async Task GivenProducerOwnedPlot_WhenStartingSecondCycleOnSamePlot_ThenFarmReturnsConflict()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var producer = await CreateProducerContextAsync(cancellationToken);
        var property = await CreatePropertyAsync(producer, cancellationToken);
        var cropTypeCatalogId = await Fixture.EnsureFarmSystemCropCatalogAsync("Soy", cancellationToken);
        var plot = await CreatePlotAsync(producer, property.Id, cropTypeCatalogId, cancellationToken);

        var firstCommand = new StartCropCycleCommand(
            PlotId: plot.Id,
            CropTypeCatalogId: plot.CropTypeCatalogId,
            StartedAt: DateTimeOffset.UtcNow.AddDays(-2),
            ExpectedHarvestDate: DateTimeOffset.UtcNow.AddMonths(4),
            Status: "Planted",
            SelectedCropTypeSuggestionId: plot.SelectedCropTypeSuggestionId,
            Notes: "First crop cycle");

        using var firstResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            "/api/crop-cycles",
            firstCommand,
            producer.JwtToken,
            cancellationToken);

        firstResponse.StatusCode.ShouldBe(HttpStatusCode.Created);

        var firstResult = await firstResponse.Content
            .ReadFromJsonAsync<StartCropCycleResponse>(cancellationToken: cancellationToken);

        firstResult.ShouldNotBeNull();
        firstResult!.PlotId.ShouldBe(plot.Id);

        var secondCommand = firstCommand with
        {
            StartedAt = DateTimeOffset.UtcNow.AddDays(-1),
            ExpectedHarvestDate = DateTimeOffset.UtcNow.AddMonths(5),
            Notes = "Second crop cycle should fail"
        };

        using var secondResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            "/api/crop-cycles",
            secondCommand,
            producer.JwtToken,
            cancellationToken);

        secondResponse.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task GivenActiveCropCycle_WhenPropertyLocationChanges_ThenFarmRejectsUpdateUntilCycleIsCompleted()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var producer = await CreateProducerContextAsync(cancellationToken);
        var property = await CreatePropertyAsync(producer, cancellationToken);
        var cropTypeCatalogId = await Fixture.EnsureFarmSystemCropCatalogAsync("Soy", cancellationToken);
        var plot = await CreatePlotAsync(producer, property.Id, cropTypeCatalogId, cancellationToken);

        var startCommand = new StartCropCycleCommand(
            PlotId: plot.Id,
            CropTypeCatalogId: plot.CropTypeCatalogId,
            StartedAt: DateTimeOffset.UtcNow.AddDays(-3),
            ExpectedHarvestDate: DateTimeOffset.UtcNow.AddMonths(4),
            Status: "Planted",
            SelectedCropTypeSuggestionId: plot.SelectedCropTypeSuggestionId,
            Notes: "Crop cycle under active monitoring");

        using var startResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            "/api/crop-cycles",
            startCommand,
            producer.JwtToken,
            cancellationToken);

        startResponse.StatusCode.ShouldBe(HttpStatusCode.Created);

        var startedCycle = await startResponse.Content
            .ReadFromJsonAsync<StartCropCycleResponse>(cancellationToken: cancellationToken);

        startedCycle.ShouldNotBeNull();

        var blockedUpdateCommand = new UpdatePropertyCommand(
            Id: property.Id,
            Name: property.Name,
            Address: property.Address,
            City: property.City,
            State: property.State,
            Country: property.Country,
            AreaHectares: property.AreaHectares,
            Latitude: property.Latitude + 0.1,
            Longitude: property.Longitude + 0.1);

        using var blockedUpdateResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Put,
            $"/api/properties/{property.Id}",
            blockedUpdateCommand,
            producer.JwtToken,
            cancellationToken);

        blockedUpdateResponse.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var transitionCommand = new TransitionCropCycleCommand(
            CropCycleId: startedCycle!.Id,
            NewStatus: "Growing",
            OccurredAt: DateTimeOffset.UtcNow,
            Notes: "Plants reached growing phase");

        using var transitionResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Put,
            $"/api/crop-cycles/{startedCycle.Id}/transition",
            transitionCommand,
            producer.JwtToken,
            cancellationToken);

        transitionResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var transitionedCycle = await transitionResponse.Content
            .ReadFromJsonAsync<TransitionCropCycleResponse>(cancellationToken: cancellationToken);

        transitionedCycle.ShouldNotBeNull();
        transitionedCycle!.Status.ShouldBe("Growing");

        var completeCommand = new CompleteCropCycleCommand(
            CropCycleId: startedCycle.Id,
            EndedAt: DateTimeOffset.UtcNow.AddDays(1),
            FinalStatus: "Harvested",
            Notes: "Harvest completed");

        using var completeResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            $"/api/crop-cycles/{startedCycle.Id}/complete",
            completeCommand,
            producer.JwtToken,
            cancellationToken);

        completeResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var completedCycle = await completeResponse.Content
            .ReadFromJsonAsync<CompleteCropCycleResponse>(cancellationToken: cancellationToken);

        completedCycle.ShouldNotBeNull();
        completedCycle!.Status.ShouldBe("Harvested");

        using var allowedUpdateResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Put,
            $"/api/properties/{property.Id}",
            blockedUpdateCommand,
            producer.JwtToken,
            cancellationToken);

        allowedUpdateResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var updatedProperty = await allowedUpdateResponse.Content
            .ReadFromJsonAsync<UpdatePropertyResponse>(cancellationToken: cancellationToken);

        updatedProperty.ShouldNotBeNull();
        updatedProperty!.Latitude.ShouldBe(blockedUpdateCommand.Latitude);
        updatedProperty.Longitude.ShouldBe(blockedUpdateCommand.Longitude);
    }

    private async Task<ProducerContext> CreateProducerContextAsync(CancellationToken cancellationToken)
    {
        var token = Guid.NewGuid().ToString("N")[..8];
        var password = "Producer@123";

        var createProducerCommand = new CreateUserCommand(
            Name: $"Producer {token}",
            Email: $"producer.cycles.{token}@tcagro.test",
            Username: $"producercycles{token}",
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

        return new ProducerContext(createdProducer.Id, loginResult.JwtToken, token);
    }

    private async Task<CreatePropertyResponse> CreatePropertyAsync(ProducerContext producer, CancellationToken cancellationToken)
    {
        var command = new CreatePropertyCommand(
            Name: $"Property Cycles {producer.Token}",
            Address: "Road Cycles, km 01",
            City: "Ribeirao Preto",
            State: "SP",
            Country: "Brazil",
            AreaHectares: 120.0,
            Latitude: -21.1767,
            Longitude: -47.8208);

        using var response = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            "/api/properties",
            command,
            producer.JwtToken,
            cancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdProperty = await response.Content
            .ReadFromJsonAsync<CreatePropertyResponse>(cancellationToken: cancellationToken);

        createdProperty.ShouldNotBeNull();
        return createdProperty!;
    }

    private async Task<CreatePlotResponse> CreatePlotAsync(
        ProducerContext producer,
        Guid propertyId,
        Guid cropTypeCatalogId,
        CancellationToken cancellationToken)
    {
        var command = new CreatePlotCommand(
            PropertyId: propertyId,
            Name: $"Plot Cycles {producer.Token}",
            CropType: "Soy",
            AreaHectares: 35.0,
            Latitude: -21.1775,
            Longitude: -47.8103,
            BoundaryGeoJson: "{\"type\":\"Polygon\",\"coordinates\":[[[-47.811,-21.178],[-47.809,-21.178],[-47.809,-21.176],[-47.811,-21.176],[-47.811,-21.178]]]}",
            PlantingDate: DateTimeOffset.UtcNow.AddDays(-7),
            ExpectedHarvestDate: DateTimeOffset.UtcNow.AddDays(120),
            IrrigationType: "Center Pivot",
            AdditionalNotes: "Integration crop cycle plot",
            CropTypeCatalogId: cropTypeCatalogId);

        using var response = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            "/api/plots",
            command,
            producer.JwtToken,
            cancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdPlot = await response.Content
            .ReadFromJsonAsync<CreatePlotResponse>(cancellationToken: cancellationToken);

        createdPlot.ShouldNotBeNull();
        return createdPlot!;
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
