using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using TC.Agro.IntegrationTests.Infrastructure;

namespace TC.Agro.IntegrationTests.Services;

/// <summary>
/// Integration tests for Identity Service endpoints
/// Tests authentication, user registration, and token management
/// </summary>
public class IdentityServiceTests : IntegrationTestBase
{
    public IdentityServiceTests()
    {
        ConfigureServiceUrl(ServiceEndpoints.IdentityServiceUrl);
    }

    [Fact]
    public async Task HealthCheck_ShouldReturn_Success()
    {
        // Act
        var response = await HttpClient.GetAsync("/health");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Register_WithValidData_ShouldCreateUser()
    {
        // Arrange
        var request = new
        {
            email = TestDataFactory.GenerateTestEmail(),
            password = TestDataFactory.GenerateTestPassword(),
            name = "Test User"
        };

        // Act
        var response = await PostAsync("/api/auth/register", request);

        // Assert
        response.StatusCode.Should().BeOneOf(
            HttpStatusCode.Created, 
            HttpStatusCode.OK,
            HttpStatusCode.NoContent
        );
    }

    [Fact]
    public async Task Login_WithValidCredentials_ShouldReturnToken()
    {
        // Arrange
        var email = TestDataFactory.GenerateTestEmail();
        var password = TestDataFactory.GenerateTestPassword();

        // First register the user
        var registerRequest = new
        {
            email,
            password,
            name = "Test User"
        };
        await PostAsync("/api/auth/register", registerRequest);

        var loginRequest = new
        {
            email,
            password
        };

        // Act
        var response = await PostAsync("/api/auth/login", loginRequest);

        // Assert
        response.StatusCode.Should().BeOneOf(
            HttpStatusCode.OK,
            HttpStatusCode.Accepted
        );

        if (response.IsSuccessStatusCode)
        {
            var content = await response.Content.ReadAsStringAsync();
            content.Should().NotBeNullOrEmpty();
            // Token should be in response (either as JSON or direct string)
        }
    }

    [Fact]
    public async Task Login_WithInvalidCredentials_ShouldReturnUnauthorized()
    {
        // Arrange
        var loginRequest = new
        {
            email = "nonexistent@test.com",
            password = "WrongPassword123!"
        };

        // Act
        var response = await PostAsync("/api/auth/login", loginRequest);

        // Assert
        response.StatusCode.Should().BeOneOf(
            HttpStatusCode.Unauthorized,
            HttpStatusCode.BadRequest,
            HttpStatusCode.NotFound
        );
    }

    [Fact]
    public async Task Register_WithDuplicateEmail_ShouldReturnConflict()
    {
        // Arrange
        var email = TestDataFactory.GenerateTestEmail();
        var password = TestDataFactory.GenerateTestPassword();

        var request = new
        {
            email,
            password,
            name = "Test User"
        };

        // Act - Register first time
        var firstResponse = await PostAsync("/api/auth/register", request);
        
        // Act - Try to register again with same email
        var secondResponse = await PostAsync("/api/auth/register", request);

        // Assert
        firstResponse.IsSuccessStatusCode.Should().BeTrue();
        secondResponse.StatusCode.Should().BeOneOf(
            HttpStatusCode.Conflict,
            HttpStatusCode.BadRequest
        );
    }

    [Fact]
    public async Task Register_WithInvalidEmail_ShouldReturnBadRequest()
    {
        // Arrange
        var request = new
        {
            email = "invalid-email",
            password = TestDataFactory.GenerateTestPassword(),
            name = "Test User"
        };

        // Act
        var response = await PostAsync("/api/auth/register", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Register_WithWeakPassword_ShouldReturnBadRequest()
    {
        // Arrange
        var request = new
        {
            email = TestDataFactory.GenerateTestEmail(),
            password = "123", // Too weak
            name = "Test User"
        };

        // Act
        var response = await PostAsync("/api/auth/register", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
