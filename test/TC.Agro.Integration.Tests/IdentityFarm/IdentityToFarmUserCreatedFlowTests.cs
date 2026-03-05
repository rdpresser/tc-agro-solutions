using System.Net;
using System.Net.Http.Json;
using TC.Agro.Identity.Application.UseCases.CreateUser;
using TC.Agro.Integration.Tests.Abstractions;

namespace TC.Agro.Integration.Tests.IdentityFarm;

public sealed class IdentityToFarmUserCreatedFlowTests : BaseIntegrationTest
{
    public IdentityToFarmUserCreatedFlowTests(IdentityFarmIntegrationFixture fixture)
        : base(fixture)
    {
    }

    [Fact]
    public async Task GivenProducerUserCreatedInIdentity_WhenEventIsPublished_ThenFarmProjectsOwnerSnapshot()
    {
        var request = BuildCreateUserRequest(role: "Producer");

        using var response = await Fixture.IdentityClient
            .PostAsJsonAsync("/auth/register", request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdUser = await response.Content
            .ReadFromJsonAsync<CreateUserResponse>(cancellationToken: TestContext.Current.CancellationToken);

        createdUser.ShouldNotBeNull();

        var snapshot = await Fixture
            .WaitForOwnerSnapshotAsync(createdUser!.Id, TimeSpan.FromSeconds(45), TestContext.Current.CancellationToken);

        // Since the created user is a Producer, a snapshot should be created in the Farm database with the correct details.
        snapshot.ShouldNotBeNull();
        snapshot!.Id.ShouldBe(createdUser.Id);
        snapshot.Name.ShouldBe(request.Name);
        snapshot.Email.ShouldBe(request.Email);
        snapshot.IsActive.ShouldBeTrue();
    }

    [Fact]
    public async Task GivenNonProducerUserCreatedInIdentity_WhenEventIsPublished_ThenFarmDoesNotProjectOwnerSnapshot()
    {
        var request = BuildCreateUserRequest(role: "Admin");

        using var response = await Fixture.IdentityClient
            .PostAsJsonAsync("/auth/register", request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);

        var createdUser = await response.Content
            .ReadFromJsonAsync<CreateUserResponse>(cancellationToken: TestContext.Current.CancellationToken);

        createdUser.ShouldNotBeNull();

        var snapshot = await Fixture
            .WaitForOwnerSnapshotAsync(createdUser!.Id, TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);

        // Since the created user is not a Producer, no snapshot should be created in the Farm database.
        snapshot.ShouldBeNull();
    }

    private static CreateUserCommand BuildCreateUserRequest(string role)
    {
        var token = Guid.NewGuid().ToString("N")[..8];

        return new CreateUserCommand(
            Name: $"Integration {token}",
            Email: $"integration.{token}@tcagro.test",
            Username: $"integration{token}",
            Password: "Producer@123",
            Role: role);
    }
}