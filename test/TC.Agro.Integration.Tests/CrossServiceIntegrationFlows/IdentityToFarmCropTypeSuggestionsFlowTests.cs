using Npgsql;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using TC.Agro.Farm.Application.UseCases.CropTypes.Regenerate;
using TC.Agro.Farm.Application.UseCases.Properties.Create;
using TC.Agro.Identity.Application.UseCases.CreateUser;
using TC.Agro.Identity.Application.UseCases.LoginUser;
using TC.Agro.Integration.Tests.Abstractions;

namespace TC.Agro.Integration.Tests.CrossServiceIntegrationFlows;

public sealed class IdentityToFarmCropTypeSuggestionsFlowTests : BaseIntegrationTest
{
    private const string FarmDatabase = "tc-agro-farm-db";

    public IdentityToFarmCropTypeSuggestionsFlowTests(CrossServiceIntegrationFixture fixture)
        : base(fixture)
    {
    }

    [Fact]
    public async Task GivenPropertyWithCoordinates_WhenRegenerationIsQueued_ThenAiSuggestionsArePersisted()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var producer = await CreateProducerContextAsync("producer.ai.suggestions", cancellationToken);
        var property = await CreatePropertyAsync(producer, includeCoordinates: true, cancellationToken);

        using var response = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            $"/api/properties/{property.Id}/crop-types/regenerate",
            new { },
            producer.JwtToken,
            cancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Accepted);

        var queuedResult = await response.Content
            .ReadFromJsonAsync<RegeneratePropertyCropTypesResponse>(cancellationToken: cancellationToken);

        queuedResult.ShouldNotBeNull();
        queuedResult!.PropertyId.ShouldBe(property.Id);
        queuedResult.Status.ShouldBe("Queued");

        var suggestionIds = await WaitForActiveAiSuggestionIdsAsync(
            property.Id,
            producer.UserId,
            timeout: TimeSpan.FromSeconds(45),
            cancellationToken);

        suggestionIds.Count.ShouldBeGreaterThan(0);
    }

    [Fact]
    public async Task GivenUnknownProperty_WhenRegenerationIsQueued_ThenFarmReturnsNotFound()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var producer = await CreateProducerContextAsync("producer.ai.notfound", cancellationToken);
        var unknownPropertyId = Guid.NewGuid();

        using var response = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            $"/api/properties/{unknownPropertyId}/crop-types/regenerate",
            new { },
            producer.JwtToken,
            cancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GivenPropertyWithoutCoordinates_WhenRegenerationIsQueued_ThenFarmReturnsBadRequestAndNoAiSuggestionsAreCreated()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var producer = await CreateProducerContextAsync("producer.ai.missingcoords", cancellationToken);
        var property = await CreatePropertyAsync(producer, includeCoordinates: false, cancellationToken);

        using var response = await SendAuthorizedJsonAsync(
            Fixture.FarmClient,
            HttpMethod.Post,
            $"/api/properties/{property.Id}/crop-types/regenerate",
            new { },
            producer.JwtToken,
            cancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var activeSuggestionCount = await GetActiveAiSuggestionCountAsync(
            property.Id,
            producer.UserId,
            cancellationToken);

        activeSuggestionCount.ShouldBe(0);
    }

    [Fact]
    public async Task GivenAnonymousRequest_WhenRegenerationIsQueued_ThenFarmReturnsUnauthorized()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var producer = await CreateProducerContextAsync("producer.ai.unauthorized", cancellationToken);
        var property = await CreatePropertyAsync(producer, includeCoordinates: true, cancellationToken);

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/properties/{property.Id}/crop-types/regenerate");

        using var response = await Fixture.FarmClient.SendAsync(request, cancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
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

    private async Task<CreatePropertyResponse> CreatePropertyAsync(
        ProducerContext producer,
        bool includeCoordinates,
        CancellationToken cancellationToken)
    {
        var command = new CreatePropertyCommand(
            Name: $"Property AI Suggestions {producer.Token}",
            Address: "Road AI, km 01",
            City: "Ribeirao Preto",
            State: "SP",
            Country: "Brazil",
            AreaHectares: 90.0,
            Latitude: includeCoordinates ? -21.1767 : null,
            Longitude: includeCoordinates ? -47.8208 : null);

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

    private static async Task<IReadOnlyList<Guid>> WaitForActiveAiSuggestionIdsAsync(
        Guid propertyId,
        Guid ownerId,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        var deadline = DateTimeOffset.UtcNow + timeout;

        while (DateTimeOffset.UtcNow < deadline)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var activeIds = await GetActiveAiSuggestionIdsAsync(propertyId, ownerId, cancellationToken);
            if (activeIds.Count > 0)
            {
                return activeIds;
            }

            await Task.Delay(TimeSpan.FromMilliseconds(500), cancellationToken).ConfigureAwait(false);
        }

        return [];
    }

    private static async Task<int> GetActiveAiSuggestionCountAsync(
        Guid propertyId,
        Guid ownerId,
        CancellationToken cancellationToken)
    {
        var connectionString = BuildFarmConnectionString();

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var command = new NpgsqlCommand(
            """
            SELECT COUNT(*)
            FROM public.crop_type_suggestions
            WHERE property_id = @propertyId
              AND owner_id = @ownerId
              AND source = 'AI'
              AND is_active = true;
            """,
            connection);

        command.Parameters.AddWithValue("propertyId", propertyId);
        command.Parameters.AddWithValue("ownerId", ownerId);

        var result = await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);
        return result is long longValue ? (int)longValue : Convert.ToInt32(result);
    }

    private static async Task<IReadOnlyList<Guid>> GetActiveAiSuggestionIdsAsync(
        Guid propertyId,
        Guid ownerId,
        CancellationToken cancellationToken)
    {
        var connectionString = BuildFarmConnectionString();

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var command = new NpgsqlCommand(
            """
            SELECT id
            FROM public.crop_type_suggestions
            WHERE property_id = @propertyId
              AND owner_id = @ownerId
              AND source = 'AI'
              AND is_active = true
            ORDER BY created_at DESC;
            """,
            connection);

        command.Parameters.AddWithValue("propertyId", propertyId);
        command.Parameters.AddWithValue("ownerId", ownerId);

        var ids = new List<Guid>();

        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            ids.Add(reader.GetFieldValue<Guid>(0));
        }

        return ids;
    }

    private static string BuildFarmConnectionString()
    {
        var host = GetRequiredEnvironmentVariable("Database__Postgres__Host");
        var userName = GetRequiredEnvironmentVariable("Database__Postgres__UserName");
        var password = GetRequiredEnvironmentVariable("Database__Postgres__Password");
        var portValue = GetRequiredEnvironmentVariable("Database__Postgres__Port");

        if (!int.TryParse(portValue, out var port))
        {
            port = 5432;
        }

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = host,
            Port = port,
            Database = FarmDatabase,
            Username = userName,
            Password = password,
            SearchPath = "public",
            Timeout = 30,
            IncludeErrorDetail = true
        };

        return builder.ConnectionString;
    }

    private static string GetRequiredEnvironmentVariable(string variableName)
    {
        var value = Environment.GetEnvironmentVariable(variableName);
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"Environment variable '{variableName}' is not configured.");
        }

        return value;
    }

    private sealed record ProducerContext(Guid UserId, string JwtToken, string Token);
}
