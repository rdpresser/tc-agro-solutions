using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using TC.Agro.Farm.Application.UseCases.CropTypes.Create;
using TC.Agro.Farm.Application.UseCases.CropTypes.GetById;
using TC.Agro.Farm.Application.UseCases.CropTypes.List;
using TC.Agro.Farm.Application.UseCases.CropTypes.Update;
using TC.Agro.Farm.Application.UseCases.CropTypes.Delete;
using TC.Agro.Farm.Application.UseCases.Properties.Create;
using TC.Agro.Identity.Application.UseCases.CreateUser;
using TC.Agro.Identity.Application.UseCases.LoginUser;
using TC.Agro.Integration.Tests.Abstractions;
using TC.Agro.SharedKernel.Infrastructure.Pagination;

namespace TC.Agro.Integration.Tests.CrossServiceIntegrationFlows;

/// <summary>
/// Cross-service E2E tests covering the full CropType Catalog lifecycle:
/// Create, Get by Id, List, Update, Delete, authorization, and tenant isolation.
/// </summary>
public sealed class IdentityToFarmCropTypeCatalogCrudFlowTests : BaseIntegrationTest
{
    public IdentityToFarmCropTypeCatalogCrudFlowTests(CrossServiceIntegrationFixture fixture)
        : base(fixture)
    {
    }

    // ──────────────────────────────────────────
    // Full CRUD lifecycle
    // ──────────────────────────────────────────

    [Fact]
    public async Task GivenProducer_WhenManagingCropTypeCatalog_ThenFullCrudLifecycleSucceeds()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var producer = await CreateProducerContextAsync(cancellationToken);
        await CreatePropertyAsync(producer, cancellationToken);

        var cropTypeName = $"IntegrationSugarcane{producer.Token}";

        // ── CREATE ──
        var createCommand = new CreateCropTypeCommand(
            CropType: cropTypeName,
            PlantingWindow: "October to December",
            HarvestCycleMonths: 12,
            SuggestedIrrigationType: "Drip Irrigation",
            MinSoilMoisture: 30,
            MaxTemperature: 38,
            MinHumidity: 40,
            Notes: "Requires rich soil",
            SuggestedImage: "sugar");

        using var createResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient, HttpMethod.Post, "/api/crop-types",
            createCommand, producer.JwtToken, cancellationToken);

        createResponse.StatusCode.ShouldBe(HttpStatusCode.Created);

        var created = await createResponse.Content
            .ReadFromJsonAsync<CreateCropTypeResponse>(cancellationToken: cancellationToken);

        created.ShouldNotBeNull();
        created!.CropType.ShouldBe(cropTypeName);
        created.Source.ShouldBe("Catalog");

        var cropTypeId = created.Id;

        // ── GET BY ID ──
        using var getResponse = await SendAuthorizedGetAsync(
            Fixture.FarmClient,
            $"/api/crop-types/{cropTypeId}",
            producer.JwtToken, cancellationToken);

        getResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var details = await getResponse.Content
            .ReadFromJsonAsync<GetCropTypeByIdResponse>(cancellationToken: cancellationToken);

        details.ShouldNotBeNull();
        details!.Id.ShouldBe(cropTypeId);
        details.CropType.ShouldBe(cropTypeName);
        details.Source.ShouldBe("Catalog");

        // ── LIST ──
        using var listResponse = await SendAuthorizedGetAsync(
            Fixture.FarmClient,
            "/api/crop-types?pageNumber=1&pageSize=50",
            producer.JwtToken, cancellationToken);

        listResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var listResult = await listResponse.Content
            .ReadFromJsonAsync<PaginatedResponse<ListCropTypesResponse>>(
                new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web),
                cancellationToken);

        listResult.ShouldNotBeNull();
        listResult!.Data.ShouldContain(x =>
            x.Id == cropTypeId && string.Equals(x.CropType, cropTypeName, StringComparison.OrdinalIgnoreCase));

        // ── UPDATE ──
        var updateCommand = new UpdateCropTypeCommand(
            CropTypeId: cropTypeId,
            CropType: cropTypeName,
            PlantingWindow: "November to January",
            HarvestCycleMonths: 14,
            SuggestedIrrigationType: "Sprinkler",
            MinSoilMoisture: 35,
            MaxTemperature: 40,
            MinHumidity: 42,
            Notes: "Updated notes",
            SuggestedImage: "sugarcane");

        using var updateResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient, HttpMethod.Put, $"/api/crop-types/{cropTypeId}",
            updateCommand, producer.JwtToken, cancellationToken);

        updateResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        // ── GET BY ID after update ──
        using var updatedGetResponse = await SendAuthorizedGetAsync(
            Fixture.FarmClient,
            $"/api/crop-types/{cropTypeId}",
            producer.JwtToken, cancellationToken);

        var updatedDetails = await updatedGetResponse.Content
            .ReadFromJsonAsync<GetCropTypeByIdResponse>(cancellationToken: cancellationToken);

        updatedDetails!.HarvestCycleMonths.ShouldBe(14);
        updatedDetails.SuggestedIrrigationType.ShouldBe("Sprinkler");

        // ── DELETE ──
        using var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, $"/api/crop-types/{cropTypeId}");
        deleteRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", producer.JwtToken);

        using var deleteResponse = await Fixture.FarmClient.SendAsync(deleteRequest, cancellationToken);

        deleteResponse.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    // ──────────────────────────────────────────
    // Duplicate name returns conflict
    // ──────────────────────────────────────────

    [Fact]
    public async Task GivenExistingCropType_WhenCreatingDuplicate_ThenFarmReturnsConflict()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var producer = await CreateProducerContextAsync(cancellationToken);
        await CreatePropertyAsync(producer, cancellationToken);

        var name = $"DupeCrop{producer.Token}";
        var cmd = BuildCreateCommand(name);

        using var first = await SendAuthorizedJsonAsync(
            Fixture.FarmClient, HttpMethod.Post, "/api/crop-types", cmd, producer.JwtToken, cancellationToken);
        first.StatusCode.ShouldBe(HttpStatusCode.Created);

        using var second = await SendAuthorizedJsonAsync(
            Fixture.FarmClient, HttpMethod.Post, "/api/crop-types", cmd, producer.JwtToken, cancellationToken);

        // Duplicate should be rejected
        second.StatusCode.ShouldBeOneOf(HttpStatusCode.Conflict, HttpStatusCode.BadRequest);
    }

    // ──────────────────────────────────────────
    // Unauthorized access
    // ──────────────────────────────────────────

    [Fact]
    public async Task GivenNoToken_WhenCreatingCropType_ThenFarmReturnsUnauthorized()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var cmd = BuildCreateCommand("UnauthorizedCrop");

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/crop-types")
        {
            Content = JsonContent.Create(cmd)
        };

        using var response = await Fixture.FarmClient.SendAsync(request, cancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    // ──────────────────────────────────────────
    // Get unknown ID returns 404
    // ──────────────────────────────────────────

    [Fact]
    public async Task GivenUnknownCropTypeId_WhenGettingById_ThenFarmReturnsNotFound()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var producer = await CreateProducerContextAsync(cancellationToken);

        using var response = await SendAuthorizedGetAsync(
            Fixture.FarmClient,
            $"/api/crop-types/{Guid.NewGuid()}",
            producer.JwtToken, cancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    // ──────────────────────────────────────────
    // Tenant isolation — producer B cannot see A's private entries
    // ──────────────────────────────────────────

    [Fact]
    public async Task GivenTwoProducers_WhenListingCropTypes_ThenEachSeesOnlyOwnEntries()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var producerA = await CreateProducerContextAsync(cancellationToken);
        var producerB = await CreateProducerContextAsync(cancellationToken);

        await CreatePropertyAsync(producerA, cancellationToken);
        await CreatePropertyAsync(producerB, cancellationToken);

        var nameA = $"ProducerACrop{producerA.Token}";
        var nameB = $"ProducerBCrop{producerB.Token}";

        using var respA = await SendAuthorizedJsonAsync(
            Fixture.FarmClient, HttpMethod.Post, "/api/crop-types",
            BuildCreateCommand(nameA), producerA.JwtToken, cancellationToken);

        respA.StatusCode.ShouldBe(HttpStatusCode.Created);

        using var respB = await SendAuthorizedJsonAsync(
            Fixture.FarmClient, HttpMethod.Post, "/api/crop-types",
            BuildCreateCommand(nameB), producerB.JwtToken, cancellationToken);

        respB.StatusCode.ShouldBe(HttpStatusCode.Created);

        // List as Producer A — should see A's entry, not B's
        using var listAResponse = await SendAuthorizedGetAsync(
            Fixture.FarmClient,
            "/api/crop-types?pageNumber=1&pageSize=100",
            producerA.JwtToken, cancellationToken);

        listAResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var listA = await listAResponse.Content
            .ReadFromJsonAsync<PaginatedResponse<ListCropTypesResponse>>(
                new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web),
                cancellationToken);

        listA!.Data.ShouldContain(x => string.Equals(x.CropType, nameA, StringComparison.OrdinalIgnoreCase));
        listA.Data.ShouldNotContain(x => string.Equals(x.CropType, nameB, StringComparison.OrdinalIgnoreCase));
    }

    // ──────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────

    private async Task<ProducerContext> CreateProducerContextAsync(CancellationToken cancellationToken)
    {
        var token = Guid.NewGuid().ToString("N")[..8];
        var password = "Producer@123";

        var createCmd = new CreateUserCommand(
            Name: $"Producer {token}",
            Email: $"producer.catalog.{token}@tcagro.test",
            Username: $"producercatalog{token}",
            Password: password,
            Role: "Producer");

        using var createResp = await Fixture.IdentityClient
            .PostAsJsonAsync("/auth/register", createCmd, cancellationToken);

        createResp.StatusCode.ShouldBe(HttpStatusCode.Created);

        var created = await createResp.Content
            .ReadFromJsonAsync<CreateUserResponse>(cancellationToken: cancellationToken);

        created.ShouldNotBeNull();

        var loginResp = await Fixture.IdentityClient
            .PostAsJsonAsync("/auth/login", new LoginUserCommand(createCmd.Email, password), cancellationToken);

        loginResp.StatusCode.ShouldBe(HttpStatusCode.OK);

        var login = await loginResp.Content
            .ReadFromJsonAsync<LoginUserResponse>(cancellationToken: cancellationToken);

        login!.JwtToken.ShouldNotBeNullOrWhiteSpace();

        await Fixture.WaitForFarmOwnerSnapshotAsync(created!.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);

        return new ProducerContext(created.Id, login.JwtToken, token);
    }

    private async Task<CreatePropertyResponse> CreatePropertyAsync(
        ProducerContext producer,
        CancellationToken cancellationToken)
    {
        var cmd = new CreatePropertyCommand(
            Name: $"Property Catalog {producer.Token}",
            Address: "Road Catalog, km 01",
            City: "Ribeirao Preto",
            State: "SP",
            Country: "Brazil",
            AreaHectares: 100.0,
            Latitude: -21.1767,
            Longitude: -47.8208);

        using var resp = await SendAuthorizedJsonAsync(
            Fixture.FarmClient, HttpMethod.Post, "/api/properties",
            cmd, producer.JwtToken, cancellationToken);

        resp.StatusCode.ShouldBe(HttpStatusCode.Created);

        var created = await resp.Content
            .ReadFromJsonAsync<CreatePropertyResponse>(cancellationToken: cancellationToken);

        created.ShouldNotBeNull();
        return created!;
    }

    private static CreateCropTypeCommand BuildCreateCommand(string name)
        => new(
            CropType: name,
            PlantingWindow: "Oct-Dec",
            HarvestCycleMonths: 5,
            SuggestedIrrigationType: "Drip",
            MinSoilMoisture: 30,
            MaxTemperature: 35,
            MinHumidity: 40,
            Notes: null,
            SuggestedImage: "crop");

    private static Task<HttpResponseMessage> SendAuthorizedJsonAsync<TPayload>(
        HttpClient client,
        HttpMethod method,
        string route,
        TPayload payload,
        string jwtToken,
        CancellationToken cancellationToken)
    {
        var request = new HttpRequestMessage(method, route)
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwtToken);
        return client.SendAsync(request, cancellationToken);
    }

    private static Task<HttpResponseMessage> SendAuthorizedGetAsync(
        HttpClient client,
        string route,
        string jwtToken,
        CancellationToken cancellationToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, route);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwtToken);
        return client.SendAsync(request, cancellationToken);
    }

    private sealed record ProducerContext(Guid UserId, string JwtToken, string Token);
}
