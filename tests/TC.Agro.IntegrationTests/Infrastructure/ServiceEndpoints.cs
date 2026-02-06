namespace TC.Agro.IntegrationTests.Infrastructure;

/// <summary>
/// Centralized configuration for service endpoints
/// Can be configured via environment variables or appsettings
/// </summary>
public static class ServiceEndpoints
{
    // Default URLs for Docker Compose setup
    public static readonly string IdentityServiceUrl = 
        Environment.GetEnvironmentVariable("IDENTITY_SERVICE_URL") ?? "http://localhost:5001";
    
    public static readonly string FarmServiceUrl = 
        Environment.GetEnvironmentVariable("FARM_SERVICE_URL") ?? "http://localhost:5002";
    
    public static readonly string SensorIngestServiceUrl = 
        Environment.GetEnvironmentVariable("SENSOR_INGEST_SERVICE_URL") ?? "http://localhost:5003";
    
    public static readonly string DashboardServiceUrl = 
        Environment.GetEnvironmentVariable("DASHBOARD_SERVICE_URL") ?? "http://localhost:5004";

    // K3D URLs (alternative configuration)
    public static readonly string K3dBaseUrl = 
        Environment.GetEnvironmentVariable("K3D_BASE_URL") ?? "http://localhost";
}
