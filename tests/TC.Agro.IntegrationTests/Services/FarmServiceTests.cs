using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using TC.Agro.IntegrationTests.Infrastructure;

namespace TC.Agro.IntegrationTests.Services;

/// <summary>
/// Integration tests for Farm Service endpoints
/// Tests property and plot management
/// </summary>
public class FarmServiceTests : IntegrationTestBase
{
    public FarmServiceTests()
    {
        ConfigureServiceUrl(ServiceEndpoints.FarmServiceUrl);
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
    public async Task CreateProperty_WithValidData_ShouldReturnSuccess()
    {
        // Arrange
        var request = new
        {
            name = TestDataFactory.GeneratePropertyName(),
            location = TestDataFactory.GenerateLocation(),
            areaHectares = TestDataFactory.GenerateAreaHectares(),
            ownerId = Guid.NewGuid()
        };

        // Act
        var response = await PostAsync("/api/properties", request);

        // Assert
        response.StatusCode.Should().BeOneOf(
            HttpStatusCode.Created,
            HttpStatusCode.OK
        );

        if (response.StatusCode == HttpStatusCode.Created)
        {
            var locationHeader = response.Headers.Location;
            locationHeader.Should().NotBeNull();
        }
    }

    [Fact]
    public async Task GetProperties_ShouldReturnList()
    {
        // Act
        var response = await HttpClient.GetAsync("/api/properties");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task CreateProperty_WithInvalidData_ShouldReturnBadRequest()
    {
        // Arrange - Missing required fields
        var request = new
        {
            name = "", // Empty name
            location = TestDataFactory.GenerateLocation()
        };

        // Act
        var response = await PostAsync("/api/properties", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreatePlot_WithValidData_ShouldReturnSuccess()
    {
        // Arrange
        var propertyId = await CreateTestProperty();

        var request = new
        {
            name = TestDataFactory.GeneratePlotName(),
            propertyId,
            areaHectares = TestDataFactory.GenerateAreaHectares() / 10, // Smaller than property
            cropType = TestDataFactory.GetRandomCropType()
        };

        // Act
        var response = await PostAsync("/api/plots", request);

        // Assert
        response.StatusCode.Should().BeOneOf(
            HttpStatusCode.Created,
            HttpStatusCode.OK
        );
    }

    [Fact]
    public async Task GetPlots_ByPropertyId_ShouldReturnList()
    {
        // Arrange
        var propertyId = await CreateTestProperty();

        // Act
        var response = await HttpClient.GetAsync($"/api/plots?propertyId={propertyId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task UpdateProperty_WithValidData_ShouldReturnSuccess()
    {
        // Arrange
        var propertyId = await CreateTestProperty();

        var updateRequest = new
        {
            name = TestDataFactory.GeneratePropertyName() + " Updated",
            location = TestDataFactory.GenerateLocation(),
            areaHectares = TestDataFactory.GenerateAreaHectares()
        };

        // Act
        var response = await PutAsync($"/api/properties/{propertyId}", updateRequest);

        // Assert
        response.StatusCode.Should().BeOneOf(
            HttpStatusCode.OK,
            HttpStatusCode.NoContent
        );
    }

    [Fact]
    public async Task DeleteProperty_WithValidId_ShouldReturnSuccess()
    {
        // Arrange
        var propertyId = await CreateTestProperty();

        // Act
        var response = await DeleteAsync($"/api/properties/{propertyId}");

        // Assert
        response.StatusCode.Should().BeOneOf(
            HttpStatusCode.OK,
            HttpStatusCode.NoContent
        );
    }

    [Fact]
    public async Task GetPropertyById_WithInvalidId_ShouldReturnNotFound()
    {
        // Arrange
        var invalidId = Guid.NewGuid();

        // Act
        var response = await HttpClient.GetAsync($"/api/properties/{invalidId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    /// <summary>
    /// Helper method to create a test property and return its ID
    /// </summary>
    private async Task<Guid> CreateTestProperty()
    {
        var request = new
        {
            name = TestDataFactory.GeneratePropertyName(),
            location = TestDataFactory.GenerateLocation(),
            areaHectares = TestDataFactory.GenerateAreaHectares(),
            ownerId = Guid.NewGuid()
        };

        var response = await PostAsync("/api/properties", request);
        response.EnsureSuccessStatusCode();

        // Try to extract ID from Location header or response body
        if (response.Headers.Location != null)
        {
            var segments = response.Headers.Location.Segments;
            var idString = segments.Last().TrimEnd('/');
            if (Guid.TryParse(idString, out var id))
            {
                return id;
            }
        }

        // If we can't get from header, try from response body
        var content = await response.Content.ReadAsStringAsync();
        if (!string.IsNullOrEmpty(content))
        {
            try
            {
                var result = System.Text.Json.JsonSerializer.Deserialize<dynamic>(content);
                return Guid.Parse(result.GetProperty("id").GetString());
            }
            catch
            {
                // If all else fails, return a new GUID (test might fail, but that's informative)
                return Guid.NewGuid();
            }
        }

        return Guid.NewGuid();
    }
}
