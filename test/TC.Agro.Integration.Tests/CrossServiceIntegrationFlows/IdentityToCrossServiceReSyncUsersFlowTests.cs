using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using TC.Agro.Identity.Application.UseCases.CreateUser;
using TC.Agro.Identity.Application.UseCases.LoginUser;
using TC.Agro.Identity.Application.UseCases.ReSyncUsers;
using TC.Agro.Integration.Tests.Abstractions;

namespace TC.Agro.Integration.Tests.CrossServiceIntegrationFlows;

public sealed class IdentityToCrossServiceReSyncUsersFlowTests : BaseIntegrationTest
{
    public IdentityToCrossServiceReSyncUsersFlowTests(CrossServiceIntegrationFixture fixture)
        : base(fixture)
    {
    }

    [Fact]
    public async Task GivenProducerSnapshotsWereRemoved_WhenAdminTriggersResync_ThenSnapshotsAreReprojectedInAllConsumers()
    {
        var cancellationToken = TestContext.Current.CancellationToken;

        var admin = await CreateUserAndLoginAsync("Admin", "admin.resync", cancellationToken);
        var producer = await CreateUserAndLoginAsync("Producer", "producer.resync", cancellationToken);

        await Fixture.WaitForFarmOwnerSnapshotAsync(producer.User.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);
        await Fixture.WaitForSensorIngestOwnerSnapshotAsync(producer.User.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);
        await Fixture.WaitForAnalyticsOwnerSnapshotAsync(producer.User.Id, TimeSpan.FromSeconds(45), cancellationToken: cancellationToken);

        await Fixture.DeleteOwnerSnapshotsFromConsumersAsync(producer.User.Id, cancellationToken);

        var farmDeleted = await Fixture.WaitForFarmOwnerSnapshotAsync(producer.User.Id, TimeSpan.FromSeconds(3), cancellationToken: cancellationToken);
        var sensorIngestDeleted = await Fixture.WaitForSensorIngestOwnerSnapshotAsync(producer.User.Id, TimeSpan.FromSeconds(3), cancellationToken: cancellationToken);
        var analyticsDeleted = await Fixture.WaitForAnalyticsOwnerSnapshotAsync(producer.User.Id, TimeSpan.FromSeconds(3), cancellationToken: cancellationToken);

        farmDeleted.ShouldBeNull();
        sensorIngestDeleted.ShouldBeNull();
        analyticsDeleted.ShouldBeNull();

        using var response = await SendAuthorizedAsync(
            Fixture.IdentityClient,
            HttpMethod.Post,
            "/auth/resync/users",
            admin.JwtToken,
            cancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);

        var payload = await response.Content
            .ReadFromJsonAsync<ReSyncUsersResponse>(cancellationToken: cancellationToken);

        payload.ShouldNotBeNull();
        payload!.TotalActiveUsers.ShouldBeGreaterThanOrEqualTo(1);
        payload.RepublishedUsers.ShouldBeGreaterThanOrEqualTo(1);

        var farmSnapshot = await Fixture.WaitForFarmOwnerSnapshotAsync(
            producer.User.Id,
            TimeSpan.FromSeconds(45),
            row => row.IsActive,
            cancellationToken);

        var sensorIngestSnapshot = await Fixture.WaitForSensorIngestOwnerSnapshotAsync(
            producer.User.Id,
            TimeSpan.FromSeconds(45),
            row => row.IsActive,
            cancellationToken);

        var analyticsSnapshot = await Fixture.WaitForAnalyticsOwnerSnapshotAsync(
            producer.User.Id,
            TimeSpan.FromSeconds(45),
            row => row.IsActive,
            cancellationToken);

        farmSnapshot.ShouldNotBeNull();
        sensorIngestSnapshot.ShouldNotBeNull();
        analyticsSnapshot.ShouldNotBeNull();

        farmSnapshot!.Name.ShouldBe(producer.Request.Name);
        farmSnapshot.Email.ShouldBe(producer.Request.Email);

        sensorIngestSnapshot!.Name.ShouldBe(producer.Request.Name);
        sensorIngestSnapshot.Email.ShouldBe(producer.Request.Email);

        analyticsSnapshot!.Name.ShouldBe(producer.Request.Name);
        analyticsSnapshot.Email.ShouldBe(producer.Request.Email);
    }

    [Fact]
    public async Task GivenProducerUser_WhenNonAdminCallsResync_ThenRequestIsForbidden()
    {
        var cancellationToken = TestContext.Current.CancellationToken;

        var producer = await CreateUserAndLoginAsync("Producer", "producer.forbidden", cancellationToken);

        using var response = await SendAuthorizedAsync(
            Fixture.IdentityClient,
            HttpMethod.Post,
            "/auth/resync/users",
            producer.JwtToken,
            cancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    private async Task<AuthenticatedUserContext> CreateUserAndLoginAsync(
        string role,
        string emailPrefix,
        CancellationToken cancellationToken)
    {
        var token = Guid.NewGuid().ToString("N")[..8];
        var password = "Producer@123";

        var request = new CreateUserCommand(
            Name: $"{role} {token}",
            Email: $"{emailPrefix}.{token}@tcagro.test",
            Username: $"{emailPrefix.Replace(".", string.Empty)}{token}",
            Password: password,
            Role: role);

        using var createUserResponse = await Fixture.IdentityClient
            .PostAsJsonAsync("/auth/register", request, cancellationToken);

        createUserResponse.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdUser = await createUserResponse.Content
            .ReadFromJsonAsync<CreateUserResponse>(cancellationToken: cancellationToken);

        createdUser.ShouldNotBeNull();

        using var loginResponse = await Fixture.IdentityClient
            .PostAsJsonAsync("/auth/login", new LoginUserCommand(request.Email, password), cancellationToken);

        loginResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var loginResult = await loginResponse.Content
            .ReadFromJsonAsync<LoginUserResponse>(cancellationToken: cancellationToken);

        loginResult.ShouldNotBeNull();
        loginResult!.JwtToken.ShouldNotBeNullOrWhiteSpace();

        return new AuthenticatedUserContext(request, createdUser!, loginResult.JwtToken);
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

    private sealed record AuthenticatedUserContext(
        CreateUserCommand Request,
        CreateUserResponse User,
        string JwtToken);
}
