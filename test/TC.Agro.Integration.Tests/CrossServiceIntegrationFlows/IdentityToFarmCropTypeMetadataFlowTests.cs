using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using TC.Agro.Farm.Application.UseCases.CropTypes.Create;
using TC.Agro.Farm.Application.UseCases.CropTypes.GetById;
using TC.Agro.Farm.Application.UseCases.CropTypes.List;
using TC.Agro.Farm.Application.UseCases.Properties.Create;
using TC.Agro.Identity.Application.UseCases.CreateUser;
using TC.Agro.Identity.Application.UseCases.LoginUser;
using TC.Agro.Integration.Tests.Abstractions;
using TC.Agro.SharedKernel.Infrastructure.Pagination;

namespace TC.Agro.Integration.Tests.CrossServiceIntegrationFlows;

public sealed class IdentityToFarmCropTypeMetadataFlowTests : BaseIntegrationTest
{
    public IdentityToFarmCropTypeMetadataFlowTests(CrossServiceIntegrationFixture fixture)
        : base(fixture)
    {
    }

    [Fact]
    public async Task GivenCatalogEntryCreatedForProperty_WhenListingAndGettingCropTypes_ThenResponseKeepsCatalogMetadata()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var producer = await CreateProducerContextAsync(cancellationToken);
        var property = await CreatePropertyAsync(producer, cancellationToken);
        var cropTypeName = $"IntegrationSoy{producer.Token}";

        var createCropTypeCommand = new CreateCropTypeCommand(
            PropertyId: property.Id,
            CropType: cropTypeName,
            PlantingWindow: "September to November",
            HarvestCycleMonths: 5,
            SuggestedIrrigationType: "Drip Irrigation",
            MinSoilMoisture: 32,
            MaxTemperature: 35,
            MinHumidity: 44,
            Notes: "Manual override for integration tests",
            SuggestedImage: "soy-icon");

        using var createResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            "/api/crop-types",
            createCropTypeCommand,
            producer.JwtToken,
            cancellationToken);

        createResponse.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdSuggestion = await createResponse.Content
            .ReadFromJsonAsync<CreateCropTypeResponse>(cancellationToken: cancellationToken);

        createdSuggestion.ShouldNotBeNull();
        createdSuggestion!.Source.ShouldBe("Catalog");
        createdSuggestion.SuggestedImage.ShouldBe("soy-icon");
        createdSuggestion.CropType.ShouldBe(cropTypeName);
        createdSuggestion.CropTypeCatalogId.ShouldBe(createdSuggestion.Id);

        using var listRequest = new HttpRequestMessage(
            HttpMethod.Get,
            $"/api/crop-types?propertyId={property.Id}&pageNumber=1&pageSize=50&includeStale=false&includeInactive=false");
        listRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", producer.JwtToken);

        using var listResponse = await Fixture.FarmClient.SendAsync(listRequest, cancellationToken);

        listResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var listResult = await listResponse.Content
            .ReadFromJsonAsync<PaginatedResponse<ListCropTypesResponse>>(cancellationToken: cancellationToken);

        listResult.ShouldNotBeNull();

        var listedCropType = listResult!.Data.SingleOrDefault(item =>
            item.CropTypeCatalogId == createdSuggestion.CropTypeCatalogId &&
            string.Equals(item.CropType, cropTypeName, StringComparison.OrdinalIgnoreCase));

        listedCropType.ShouldNotBeNull();
        listedCropType!.Id.ShouldBe(createdSuggestion.CropTypeCatalogId);
        listedCropType.PropertyId.ShouldBe(property.Id);
        listedCropType.Source.ShouldBe("Catalog");
        listedCropType.SuggestedImage.ShouldBe("soy-icon");
        listedCropType.CropTypeCatalogId.ShouldBe(createdSuggestion.CropTypeCatalogId);
        listedCropType.SelectedCropTypeSuggestionId.ShouldBeNull();

        using var detailsRequest = new HttpRequestMessage(HttpMethod.Get, $"/api/crop-types/{createdSuggestion.CropTypeCatalogId}");
        detailsRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", producer.JwtToken);

        using var detailsResponse = await Fixture.FarmClient.SendAsync(detailsRequest, cancellationToken);

        detailsResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var details = await detailsResponse.Content
            .ReadFromJsonAsync<GetCropTypeByIdResponse>(cancellationToken: cancellationToken);

        details.ShouldNotBeNull();
        details!.Id.ShouldBe(createdSuggestion.CropTypeCatalogId);
        details.PropertyId.ShouldBe(Guid.Empty);
        details.Source.ShouldBe("Catalog");
        details.SuggestedImage.ShouldBe("soy-icon");
        details.CropType.ShouldBe(cropTypeName);
        details.CropTypeCatalogId.ShouldBe(createdSuggestion.CropTypeCatalogId);
        details.SelectedCropTypeSuggestionId.ShouldBeNull();
    }

    private async Task<ProducerContext> CreateProducerContextAsync(CancellationToken cancellationToken)
    {
        var token = Guid.NewGuid().ToString("N")[..8];
        var password = "Producer@123";

        var createProducerCommand = new CreateUserCommand(
            Name: $"Producer {token}",
            Email: $"producer.crop-types.{token}@tcagro.test",
            Username: $"producercroptypes{token}",
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
            Name: $"Property Crop Types {producer.Token}",
            Address: "Road Crop Types, km 01",
            City: "Ribeirao Preto",
            State: "SP",
            Country: "Brazil",
            AreaHectares: 90.0,
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
