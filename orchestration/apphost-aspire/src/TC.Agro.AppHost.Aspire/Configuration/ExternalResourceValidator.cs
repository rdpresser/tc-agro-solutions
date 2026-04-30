using Microsoft.Extensions.Configuration;

namespace TC.Agro.AppHost.Aspire.Configuration;

public static class ExternalResourceValidator
{
    public static void EnsureConfigured(IConfiguration configuration)
    {
        Ensure(
            HasConnectionString(configuration, "redis") || HasValue(configuration, "Cache:Redis:Host"),
            "UseExternalResources=true requires ConnectionStrings:redis or Cache:Redis:Host.");

        Ensure(
            HasConnectionString(configuration, "rabbitmq") || HasValue(configuration, "Messaging:RabbitMQ:Host"),
            "UseExternalResources=true requires ConnectionStrings:rabbitmq or Messaging:RabbitMQ:Host.");

        Ensure(
            HasConnectionString(configuration, "postgres") || HasValue(configuration, "Database:Postgres:Host"),
            "UseExternalResources=true requires ConnectionStrings:postgres or Database:Postgres:Host.");
    }

    private static bool HasConnectionString(IConfiguration configuration, string name)
        => !string.IsNullOrWhiteSpace(configuration.GetConnectionString(name));

    private static bool HasValue(IConfiguration configuration, string key)
        => !string.IsNullOrWhiteSpace(configuration[key]);

    private static void Ensure(bool condition, string message)
    {
        if (!condition)
        {
            throw new InvalidOperationException(message);
        }
    }
}
