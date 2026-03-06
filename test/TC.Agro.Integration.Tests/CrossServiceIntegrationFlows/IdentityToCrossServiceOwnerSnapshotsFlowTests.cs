using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using TC.Agro.Identity.Application.UseCases.CreateUser;
using TC.Agro.Identity.Application.UseCases.DeactivateUser;
using TC.Agro.Identity.Application.UseCases.LoginUser;
using TC.Agro.Identity.Application.UseCases.UpdateUser;
using TC.Agro.Integration.Tests.Abstractions;

namespace TC.Agro.Integration.Tests.CrossServiceIntegrationFlows;

public sealed class IdentityToCrossServiceOwnerSnapshotsFlowTests : BaseIntegrationTest
{
    public IdentityToCrossServiceOwnerSnapshotsFlowTests(CrossServiceIntegrationFixture fixture)
        : base(fixture)
    {
    }

    [Fact]
    public async Task GivenProducerUserCreatedInIdentity_WhenEventIsPublished_ThenOwnerSnapshotIsProjectedInAllConsumers()
    {
        var (request, _) = BuildCreateUserRequest(role: "Producer");
        var cancellationToken = TestContext.Current.CancellationToken;

        using var response = await Fixture.IdentityClient
            .PostAsJsonAsync("/auth/register", request, cancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdUser = await response.Content
            .ReadFromJsonAsync<CreateUserResponse>(cancellationToken: cancellationToken);

        createdUser.ShouldNotBeNull();

        var farmSnapshot = await Fixture
            .WaitForFarmOwnerSnapshotAsync(createdUser!.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);

        var sensorIngestSnapshot = await Fixture
            .WaitForSensorIngestOwnerSnapshotAsync(createdUser.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);

        var analyticsSnapshot = await Fixture
            .WaitForAnalyticsOwnerSnapshotAsync(createdUser.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);

        farmSnapshot.ShouldNotBeNull();
        sensorIngestSnapshot.ShouldNotBeNull();
        analyticsSnapshot.ShouldNotBeNull();

        farmSnapshot!.Id.ShouldBe(createdUser.Id);
        farmSnapshot.Name.ShouldBe(request.Name);
        farmSnapshot.Email.ShouldBe(request.Email);
        farmSnapshot.IsActive.ShouldBeTrue();

        sensorIngestSnapshot!.Id.ShouldBe(createdUser.Id);
        sensorIngestSnapshot.Name.ShouldBe(request.Name);
        sensorIngestSnapshot.Email.ShouldBe(request.Email);
        sensorIngestSnapshot.IsActive.ShouldBeTrue();

        analyticsSnapshot!.Id.ShouldBe(createdUser.Id);
        analyticsSnapshot.Name.ShouldBe(request.Name);
        analyticsSnapshot.Email.ShouldBe(request.Email);
        analyticsSnapshot.IsActive.ShouldBeTrue();
    }

    [Fact]
    public async Task GivenNonProducerUserCreatedInIdentity_WhenEventIsPublished_ThenOwnerSnapshotIsNotProjectedInAnyConsumer()
    {
        var (request, _) = BuildCreateUserRequest(role: "Admin");
        var cancellationToken = TestContext.Current.CancellationToken;

        using var response = await Fixture.IdentityClient
            .PostAsJsonAsync("/auth/register", request, cancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdUser = await response.Content
            .ReadFromJsonAsync<CreateUserResponse>(cancellationToken: cancellationToken);

        createdUser.ShouldNotBeNull();

        var farmSnapshot = await Fixture
            .WaitForFarmOwnerSnapshotAsync(createdUser!.Id, TimeSpan.FromSeconds(10), cancellationToken: cancellationToken);

        var sensorIngestSnapshot = await Fixture
            .WaitForSensorIngestOwnerSnapshotAsync(createdUser.Id, TimeSpan.FromSeconds(10), cancellationToken: cancellationToken);

        var analyticsSnapshot = await Fixture
            .WaitForAnalyticsOwnerSnapshotAsync(createdUser.Id, TimeSpan.FromSeconds(10), cancellationToken: cancellationToken);

        farmSnapshot.ShouldBeNull();
        sensorIngestSnapshot.ShouldBeNull();
        analyticsSnapshot.ShouldBeNull();
    }

    [Fact]
    public async Task GivenProducerUserUpdatedAndDeactivatedInIdentity_WhenEventsArePublished_ThenAllConsumersReflectLifecycle()
    {
        var cancellationToken = TestContext.Current.CancellationToken;

        var (adminRequest, adminPassword) = BuildCreateUserRequest(role: "Admin");
        var adminUser = await RegisterUserAsync(adminRequest, cancellationToken);
        adminUser.ShouldNotBeNull();

        var adminJwt = await LoginAndGetJwtAsync(adminRequest.Email, adminPassword, cancellationToken);

        var (producerRequest, producerPassword) = BuildCreateUserRequest(role: "Producer");
        var producerUser = await RegisterUserAsync(producerRequest, cancellationToken);
        producerUser.ShouldNotBeNull();

        var producerJwt = await LoginAndGetJwtAsync(producerRequest.Email, producerPassword, cancellationToken);
        producerJwt.ShouldNotBeNullOrWhiteSpace();

        await Fixture.WaitForFarmOwnerSnapshotAsync(producerUser.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);
        await Fixture.WaitForSensorIngestOwnerSnapshotAsync(producerUser.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);
        await Fixture.WaitForAnalyticsOwnerSnapshotAsync(producerUser.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);

        var updateToken = Guid.NewGuid().ToString("N")[..8];
        var alphaToken = new string(updateToken.Where(char.IsLetter).ToArray());
        if (alphaToken.Length < 3)
        {
            alphaToken = "upd";
        }

        var updateCommand = new UpdateUserCommand(
            Id: producerUser.Id,
            Name: $"Updated {alphaToken}",
            Email: $"updated.{updateToken}@tcagro.test",
            Username: $"updated{updateToken}");

        using var updateResponse = await SendAuthorizedJsonAsync(
            Fixture.IdentityClient,
            HttpMethod.Put,
            $"/api/user/{producerUser.Id}",
            updateCommand,
            adminJwt,
            cancellationToken);

        updateResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var updateResult = await updateResponse.Content
            .ReadFromJsonAsync<UpdateUserResponse>(cancellationToken: cancellationToken);

        updateResult.ShouldNotBeNull();
        updateResult!.Id.ShouldBe(producerUser.Id);

        var farmUpdatedSnapshot = await Fixture.WaitForFarmOwnerSnapshotAsync(
            producerUser.Id,
            TimeSpan.FromSeconds(45),
            row => row.Name == updateCommand.Name && row.Email == updateCommand.Email,
            cancellationToken);

        var sensorIngestUpdatedSnapshot = await Fixture.WaitForSensorIngestOwnerSnapshotAsync(
            producerUser.Id,
            TimeSpan.FromSeconds(45),
            row => row.Name == updateCommand.Name && row.Email == updateCommand.Email,
            cancellationToken);

        var analyticsUpdatedSnapshot = await Fixture.WaitForAnalyticsOwnerSnapshotAsync(
            producerUser.Id,
            TimeSpan.FromSeconds(45),
            row => row.Name == updateCommand.Name && row.Email == updateCommand.Email,
            cancellationToken);

        farmUpdatedSnapshot.ShouldNotBeNull();
        sensorIngestUpdatedSnapshot.ShouldNotBeNull();
        analyticsUpdatedSnapshot.ShouldNotBeNull();

        using var deactivateResponse = await SendAuthorizedAsync(
            Fixture.IdentityClient,
            HttpMethod.Delete,
            $"/api/user/{producerUser.Id}",
            adminJwt,
            cancellationToken);

        deactivateResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var deactivateResult = await deactivateResponse.Content
            .ReadFromJsonAsync<DeactivateUserResponse>(cancellationToken: cancellationToken);

        deactivateResult.ShouldNotBeNull();
        deactivateResult!.Id.ShouldBe(producerUser.Id);

        var farmInactiveSnapshot = await Fixture.WaitForFarmOwnerSnapshotAsync(
            producerUser.Id,
            TimeSpan.FromSeconds(45),
            row => !row.IsActive,
            cancellationToken);

        var sensorIngestInactiveSnapshot = await Fixture.WaitForSensorIngestOwnerSnapshotAsync(
            producerUser.Id,
            TimeSpan.FromSeconds(45),
            row => !row.IsActive,
            cancellationToken);

        var analyticsInactiveSnapshot = await Fixture.WaitForAnalyticsOwnerSnapshotAsync(
            producerUser.Id,
            TimeSpan.FromSeconds(45),
            row => !row.IsActive,
            cancellationToken);

        farmInactiveSnapshot.ShouldNotBeNull();
        sensorIngestInactiveSnapshot.ShouldNotBeNull();
        analyticsInactiveSnapshot.ShouldNotBeNull();

        farmInactiveSnapshot!.IsActive.ShouldBeFalse();
        sensorIngestInactiveSnapshot!.IsActive.ShouldBeFalse();
        analyticsInactiveSnapshot!.IsActive.ShouldBeFalse();
    }

    private async Task<CreateUserResponse> RegisterUserAsync(CreateUserCommand command, CancellationToken cancellationToken)
    {
        using var response = await Fixture.IdentityClient
            .PostAsJsonAsync("/auth/register", command, cancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdUser = await response.Content
            .ReadFromJsonAsync<CreateUserResponse>(cancellationToken: cancellationToken);

        createdUser.ShouldNotBeNull();
        return createdUser!;
    }

    private async Task<string> LoginAndGetJwtAsync(string email, string password, CancellationToken cancellationToken)
    {
        var loginCommand = new LoginUserCommand(email, password);

        using var response = await Fixture.IdentityClient
            .PostAsJsonAsync("/auth/login", loginCommand, cancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);

        var loginResult = await response.Content
            .ReadFromJsonAsync<LoginUserResponse>(cancellationToken: cancellationToken);

        loginResult.ShouldNotBeNull();
        loginResult!.JwtToken.ShouldNotBeNullOrWhiteSpace();

        return loginResult.JwtToken;
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

    private static async Task<HttpResponseMessage> SendAuthorizedAsync(
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

    private static (CreateUserCommand Request, string Password) BuildCreateUserRequest(string role)
    {
        var token = Guid.NewGuid().ToString("N")[..8];
        var password = "Producer@123";

        return (
            new CreateUserCommand(
                Name: $"Integration {token}",
                Email: $"integration.{token}@tcagro.test",
                Username: $"integration{token}",
                Password: password,
                Role: role),
            password);
    }
}