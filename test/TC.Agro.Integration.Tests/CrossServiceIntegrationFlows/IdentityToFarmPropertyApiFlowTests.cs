using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using TC.Agro.Farm.Application.UseCases.Properties.Create;
using TC.Agro.Farm.Application.UseCases.Properties.Update;
using TC.Agro.Identity.Application.UseCases.CreateUser;
using TC.Agro.Identity.Application.UseCases.LoginUser;
using TC.Agro.Integration.Tests.Abstractions;
using TC.Agro.SharedKernel.Infrastructure.Pagination;

namespace TC.Agro.Integration.Tests.CrossServiceIntegrationFlows;

public sealed class IdentityToFarmPropertyApiFlowTests : BaseIntegrationTest
{
    public IdentityToFarmPropertyApiFlowTests(CrossServiceIntegrationFixture fixture)
        : base(fixture)
    {
    }

    [Fact]
    public async Task GivenProducerCreatesProperty_WhenFetchingByIdAndListing_ThenPropertyIsReturnedWithExpectedMetadata()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var producer = await CreateProducerContextAsync("producer.property.happy", cancellationToken);

        var createCommand = new CreatePropertyCommand(
            Name: $"Property Happy {producer.Token}",
            Address: "Happy Road, km 01",
            City: "Ribeirao Preto",
            State: "SP",
            Country: "Brazil",
            AreaHectares: 110.0,
            Latitude: -21.1767,
            Longitude: -47.8208);

        using var createResponse = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            "/api/properties",
            createCommand,
            producer.JwtToken,
            cancellationToken);

        createResponse.StatusCode.ShouldBe(HttpStatusCode.Created);

        var created = await createResponse.Content
            .ReadFromJsonAsync<CreatePropertyResponse>(cancellationToken: cancellationToken);

        created.ShouldNotBeNull();
        created!.Name.ShouldBe(createCommand.Name);
        created.OwnerId.ShouldBe(producer.UserId);

        using var getResponse = await SendAuthorizedRequestAsync(
            Fixture.FarmClient,
            HttpMethod.Get,
            $"/api/properties/{created.Id}",
            producer.JwtToken,
            cancellationToken);

        getResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var getById = await getResponse.Content
            .ReadFromJsonAsync<TC.Agro.Farm.Application.UseCases.Properties.GetById.GetPropertyByIdResponse>(cancellationToken: cancellationToken);

        getById.ShouldNotBeNull();
        getById!.Id.ShouldBe(created.Id);
        getById.Name.ShouldBe(createCommand.Name);

        using var listResponse = await SendAuthorizedRequestAsync(
            Fixture.FarmClient,
            HttpMethod.Get,
            "/api/properties?pageNumber=1&pageSize=50&sortBy=name&sortDirection=asc",
            producer.JwtToken,
            cancellationToken);

        listResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var listPayload = await listResponse.Content.ReadFromJsonAsync<PaginatedResponse<TC.Agro.Farm.Application.UseCases.Properties.List.ListPropertiesResponse>>(cancellationToken: cancellationToken);

        listPayload.ShouldNotBeNull();
        listPayload!.Data.Any(item => item.Id == created.Id).ShouldBeTrue();
    }

    [Fact]
    public async Task GivenAnonymousRequest_WhenGettingPropertyById_ThenFarmReturnsUnauthorized()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var producer = await CreateProducerContextAsync("producer.property.anon", cancellationToken);

        var created = await CreatePropertyAsync(producer.JwtToken, producer.Token, cancellationToken);

        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/properties/{created.Id}");
        using var response = await Fixture.FarmClient.SendAsync(request, cancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GivenProducerAttemptsInvalidCreate_WhenAreaIsNegative_ThenFarmReturnsBadRequest()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var producer = await CreateProducerContextAsync("producer.property.invalid", cancellationToken);

        var invalidCommand = new CreatePropertyCommand(
            Name: $"Property Invalid {producer.Token}",
            Address: "Validation Road, km 01",
            City: "Ribeirao Preto",
            State: "SP",
            Country: "Brazil",
            AreaHectares: -1.0,
            Latitude: -21.1767,
            Longitude: -47.8208);

        using var response = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            "/api/properties",
            invalidCommand,
            producer.JwtToken,
            cancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GivenProducerTriesToGetAnotherOwnerProperty_WhenRequestingById_ThenFarmBlocksCrossOwnerAccess()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var ownerA = await CreateProducerContextAsync("producer.property.ownera", cancellationToken);
        var ownerB = await CreateProducerContextAsync("producer.property.ownerb", cancellationToken);

        var ownerAProperty = await CreatePropertyAsync(ownerA.JwtToken, ownerA.Token, cancellationToken);

        using var response = await SendAuthorizedRequestAsync(
            Fixture.FarmClient,
            HttpMethod.Get,
            $"/api/properties/{ownerAProperty.Id}",
            ownerB.JwtToken,
            cancellationToken);

        response.StatusCode.ShouldBeOneOf(HttpStatusCode.Forbidden, HttpStatusCode.NotFound);
    }

    private async Task<CreatePropertyResponse> CreatePropertyAsync(string jwtToken, string token, CancellationToken cancellationToken)
    {
        var command = new CreatePropertyCommand(
            Name: $"Property API Flow {token}",
            Address: "Flow Road, km 01",
            City: "Ribeirao Preto",
            State: "SP",
            Country: "Brazil",
            AreaHectares: 100.0,
            Latitude: -21.1767,
            Longitude: -47.8208);

        using var response = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            "/api/properties",
            command,
            jwtToken,
            cancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);

        var created = await response.Content
            .ReadFromJsonAsync<CreatePropertyResponse>(cancellationToken: cancellationToken);

        created.ShouldNotBeNull();
        return created!;
    }

    private async Task<ProducerContext> CreateProducerContextAsync(string identityPrefix, CancellationToken cancellationToken)
    {
        var token = Guid.NewGuid().ToString("N")[..8];
        var password = "Producer@123";
        var normalizedPrefix = identityPrefix.Replace(".", string.Empty, StringComparison.Ordinal);

        var createProducerCommand = new CreateUserCommand(
            Name: $"Producer {token}",
            Email: $"{identityPrefix}.{token}@tcagro.test",
            Username: $"{normalizedPrefix}{token}",
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

        await Fixture.WaitForFarmOwnerSnapshotAsync(createdProducer!.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);

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

    private static async Task<HttpResponseMessage> SendAuthorizedRequestAsync(
        HttpClient client,
        HttpMethod method,
        string route,
        string jwtToken,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, route);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwtToken);

        return await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    private sealed record ProducerContext(Guid UserId, string JwtToken, string Token);
}
