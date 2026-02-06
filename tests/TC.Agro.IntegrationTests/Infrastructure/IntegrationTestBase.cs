using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace TC.Agro.IntegrationTests.Infrastructure;

/// <summary>
/// Base class for all integration tests providing common utilities and configuration
/// </summary>
public abstract class IntegrationTestBase : IDisposable
{
    protected readonly HttpClient HttpClient;
    protected readonly JsonSerializerOptions JsonOptions;

    protected IntegrationTestBase()
    {
        HttpClient = new HttpClient();
        JsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
    }

    /// <summary>
    /// Configure base URL for a specific service
    /// </summary>
    protected void ConfigureServiceUrl(string baseUrl)
    {
        HttpClient.BaseAddress = new Uri(baseUrl);
    }

    /// <summary>
    /// Set JWT bearer token for authenticated requests
    /// </summary>
    protected void SetAuthToken(string token)
    {
        HttpClient.DefaultRequestHeaders.Authorization = 
            new AuthenticationHeaderValue("Bearer", token);
    }

    /// <summary>
    /// Helper to make GET request and deserialize JSON response
    /// </summary>
    protected async Task<T?> GetAsync<T>(string endpoint)
    {
        var response = await HttpClient.GetAsync(endpoint);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>(JsonOptions);
    }

    /// <summary>
    /// Helper to make POST request with JSON body
    /// </summary>
    protected async Task<HttpResponseMessage> PostAsync<T>(string endpoint, T content)
    {
        return await HttpClient.PostAsJsonAsync(endpoint, content, JsonOptions);
    }

    /// <summary>
    /// Helper to make PUT request with JSON body
    /// </summary>
    protected async Task<HttpResponseMessage> PutAsync<T>(string endpoint, T content)
    {
        return await HttpClient.PutAsJsonAsync(endpoint, content, JsonOptions);
    }

    /// <summary>
    /// Helper to make DELETE request
    /// </summary>
    protected async Task<HttpResponseMessage> DeleteAsync(string endpoint)
    {
        return await HttpClient.DeleteAsync(endpoint);
    }

    public virtual void Dispose()
    {
        HttpClient?.Dispose();
    }
}
