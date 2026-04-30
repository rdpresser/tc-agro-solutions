using Aspire.Hosting;
using Microsoft.Extensions.Configuration;
using TC.Agro.AppHost.Aspire.Configuration;
using TC.Agro.AppHost.Aspire.Extensions;
using TC.Agro.SharedKernel.Infrastructure.Caching.Provider;
using TC.Agro.SharedKernel.Infrastructure.Database;
using TC.Agro.SharedKernel.Infrastructure.MessageBroker;

namespace TC.Agro.AppHost.Aspire;

public static class Program
{
    public static async Task Main(string[] args)
    {
        EnvironmentFileLoader.Load();

        var builder = DistributedApplication.CreateBuilder(args);

        var infra = builder.Configuration
            .GetSection("InfraSettings")
            .Get<InfraSettingsOptions>() ?? new InfraSettingsOptions();

        var redisFromSection = builder.Configuration
            .GetSection("Cache:Redis")
            .Get<RedisOptions>() ?? new RedisOptions();

        var rabbitFromSection = builder.Configuration
            .GetSection("Messaging:RabbitMQ")
            .Get<RabbitMqOptions>() ?? new RabbitMqOptions();

        var postgresFromSection = builder.Configuration
            .GetSection("Database:Postgres")
            .Get<PostgresOptions>() ?? new PostgresOptions();

        // External connection strings have precedence when present.
        var redisOptions = ExternalResourceOptionsResolver.ResolveRedisOptions(builder.Configuration, redisFromSection);
        var rabbitOptions = ExternalResourceOptionsResolver.ResolveRabbitMqOptions(builder.Configuration, rabbitFromSection);
        var postgresOptions = ExternalResourceOptionsResolver.ResolvePostgresOptions(builder.Configuration, postgresFromSection);

        if (infra.UseExternalResources)
        {
            ExternalResourceValidator.EnsureConfigured(builder.Configuration);
            ConfigureServicesForExternalResources(builder, redisOptions, rabbitOptions, postgresOptions);
        }
        else
        {
            ConfigureServicesWithManagedInfrastructure(builder, redisOptions, rabbitOptions, postgresOptions);
        }

        await builder.Build().RunAsync().ConfigureAwait(false);
    }

    private static void ConfigureServicesForExternalResources(
        IDistributedApplicationBuilder builder,
        RedisOptions redisOptions,
        RabbitMqOptions rabbitOptions,
        PostgresOptions postgresOptions)
    {
        var identity = builder.AddProject<Projects.TC_Agro_Identity_Service>("identity-service");
        var farm = builder.AddProject<Projects.TC_Agro_Farm_Service>("farm-service");
        var sensor = builder.AddProject<Projects.TC_Agro_SensorIngest_Service>("sensor-ingest-service");
        var analytics = builder.AddProject<Projects.TC_Agro_Analytics_Service>("analytics-worker");

        ConfigureIdentityService(identity, builder.Configuration, redisOptions, rabbitOptions, postgresOptions);
        ConfigureFarmService(farm, builder.Configuration, redisOptions, rabbitOptions, postgresOptions);
        ConfigureSensorIngestService(sensor, builder.Configuration, redisOptions, rabbitOptions, postgresOptions);
        ConfigureAnalyticsService(analytics, builder.Configuration, redisOptions, rabbitOptions, postgresOptions);
    }

    private static void ConfigureServicesWithManagedInfrastructure(
        IDistributedApplicationBuilder builder,
        RedisOptions redisOptions,
        RabbitMqOptions rabbitOptions,
        PostgresOptions postgresOptions)
    {
        var redis = builder.AddRedis("redis", redisOptions.Port);

        var rabbitUser = builder.AddParameter("rabbitmq-username", rabbitOptions.UserName);
        var rabbitPassword = builder.AddParameter("rabbitmq-password", rabbitOptions.Password, secret: true);

        var rabbitMq = builder.AddRabbitMQ("rabbitmq", rabbitUser, rabbitPassword, rabbitOptions.Port);

        var postgresUser = builder.AddParameter("postgres-username", postgresOptions.UserName);
        var postgresPassword = builder.AddParameter("postgres-password", postgresOptions.Password, secret: true);

        var postgres = builder.AddPostgres("postgres")
            .WithUserName(postgresUser)
            .WithPassword(postgresPassword)
            .WithHostPort(postgresOptions.Port);

        var identityDb = postgres.AddDatabase("identity-db", "tc-agro-identity-db");
        var farmDb = postgres.AddDatabase("farm-db", "tc-agro-farm-db");
        var sensorDb = postgres.AddDatabase("sensor-ingest-db", "tc-agro-sensor-ingest-db");
        var analyticsDb = postgres.AddDatabase("analytics-db", "tc-agro-analytics-db");

        var identity = builder.AddProject<Projects.TC_Agro_Identity_Service>("identity-service")
            .WithReference(redis)
            .WithReference(rabbitMq)
            .WithReference(identityDb)
            .WaitFor(redis)
            .WaitFor(rabbitMq)
            .WaitFor(identityDb);

        var farm = builder.AddProject<Projects.TC_Agro_Farm_Service>("farm-service")
            .WithReference(redis)
            .WithReference(rabbitMq)
            .WithReference(farmDb)
            .WaitFor(redis)
            .WaitFor(rabbitMq)
            .WaitFor(farmDb);

        var sensor = builder.AddProject<Projects.TC_Agro_SensorIngest_Service>("sensor-ingest-service")
            .WithReference(redis)
            .WithReference(rabbitMq)
            .WithReference(sensorDb)
            .WaitFor(redis)
            .WaitFor(rabbitMq)
            .WaitFor(sensorDb);

        var analytics = builder.AddProject<Projects.TC_Agro_Analytics_Service>("analytics-worker")
            .WithReference(redis)
            .WithReference(rabbitMq)
            .WithReference(analyticsDb)
            .WaitFor(redis)
            .WaitFor(rabbitMq)
            .WaitFor(analyticsDb);

        var internalRedis = new RedisOptions
        {
            Host = "redis",
            Port = redisOptions.Port,
            Password = redisOptions.Password,
            Secure = false,
            InstanceName = redisOptions.InstanceName
        };

        var internalRabbit = new RabbitMqOptions
        {
            Host = "rabbitmq",
            Port = rabbitOptions.Port,
            ManagementPort = rabbitOptions.ManagementPort,
            VirtualHost = rabbitOptions.VirtualHost,
            UserName = rabbitOptions.UserName,
            Password = rabbitOptions.Password,
            AutoProvision = rabbitOptions.AutoProvision,
            Durable = rabbitOptions.Durable,
            UseQuorumQueues = rabbitOptions.UseQuorumQueues,
            AutoPurgeOnStartup = rabbitOptions.AutoPurgeOnStartup
        };

        var internalPostgres = new PostgresOptions
        {
            Host = "postgres",
            Port = postgresOptions.Port,
            UserName = postgresOptions.UserName,
            Password = postgresOptions.Password,
            Schema = postgresOptions.Schema,
            MaintenanceDatabase = postgresOptions.MaintenanceDatabase,
            ConnectionTimeout = postgresOptions.ConnectionTimeout,
            MinPoolSize = postgresOptions.MinPoolSize,
            MaxPoolSize = postgresOptions.MaxPoolSize,
            SslMode = postgresOptions.SslMode,
            TrustServerCertificate = postgresOptions.TrustServerCertificate
        };

        ConfigureIdentityService(identity, builder.Configuration, internalRedis, internalRabbit, internalPostgres);
        ConfigureFarmService(farm, builder.Configuration, internalRedis, internalRabbit, internalPostgres);
        ConfigureSensorIngestService(sensor, builder.Configuration, internalRedis, internalRabbit, internalPostgres);
        ConfigureAnalyticsService(analytics, builder.Configuration, internalRedis, internalRabbit, internalPostgres);
    }

    private static void ConfigureIdentityService(
        IResourceBuilder<ProjectResource> project,
        IConfiguration configuration,
        RedisOptions redis,
        RabbitMqOptions rabbit,
        PostgresOptions postgres)
    {
        ConfigureSharedServiceSettings(project, configuration, redis, rabbit, postgres, 5001, "tc-agro-identity-db", "identity.events");
    }

    private static void ConfigureFarmService(
        IResourceBuilder<ProjectResource> project,
        IConfiguration configuration,
        RedisOptions redis,
        RabbitMqOptions rabbit,
        PostgresOptions postgres)
    {
        ConfigureSharedServiceSettings(project, configuration, redis, rabbit, postgres, 5002, "tc-agro-farm-db", "farm.events");
    }

    private static void ConfigureSensorIngestService(
        IResourceBuilder<ProjectResource> project,
        IConfiguration configuration,
        RedisOptions redis,
        RabbitMqOptions rabbit,
        PostgresOptions postgres)
    {
        ConfigureSharedServiceSettings(project, configuration, redis, rabbit, postgres, 5003, "tc-agro-sensor-ingest-db", "sensor-ingest.events");
    }

    private static void ConfigureAnalyticsService(
        IResourceBuilder<ProjectResource> project,
        IConfiguration configuration,
        RedisOptions redis,
        RabbitMqOptions rabbit,
        PostgresOptions postgres)
    {
        ConfigureSharedServiceSettings(project, configuration, redis, rabbit, postgres, 5004, "tc-agro-analytics-db", "analytics.events");
    }

    private static void ConfigureSharedServiceSettings(
        IResourceBuilder<ProjectResource> project,
        IConfiguration configuration,
        RedisOptions redis,
        RabbitMqOptions rabbit,
        PostgresOptions postgres,
        int httpPort,
        string databaseName,
        string exchange)
    {
        project
            .WithEnvironment("ASPNETCORE_ENVIRONMENT", configuration["ASPNETCORE_ENVIRONMENT"] ?? "Development")
            .WithEnvironment("DOTNET_ENVIRONMENT", configuration["ASPNETCORE_ENVIRONMENT"] ?? "Development")
            .WithEnvironment("ASPNETCORE_URLS", "http://0.0.0.0:" + httpPort.ToString())
            .WithEnvironment("Database__Postgres__Host", postgres.Host)
            .WithEnvironment("Database__Postgres__Port", postgres.Port.ToString())
            .WithEnvironment("Database__Postgres__Database", databaseName)
            .WithEnvironment("Database__Postgres__UserName", postgres.UserName)
            .WithEnvironment("Database__Postgres__Password", postgres.Password)
            .WithEnvironment("Database__Postgres__Schema", postgres.Schema)
            .WithEnvironment("Database__Postgres__MaintenanceDatabase", postgres.MaintenanceDatabase)
            .WithEnvironment("Database__Postgres__ConnectionTimeout", postgres.ConnectionTimeout.ToString())
            .WithEnvironment("Database__Postgres__MinPoolSize", postgres.MinPoolSize.ToString())
            .WithEnvironment("Database__Postgres__MaxPoolSize", postgres.MaxPoolSize.ToString())
            .WithEnvironment("Database__Postgres__IncludeErrorDetail", configuration["Database:Postgres:IncludeErrorDetail"] ?? "false")
            .WithEnvironment("Cache__Redis__Host", redis.Host)
            .WithEnvironment("Cache__Redis__Port", redis.Port.ToString())
            .WithEnvironment("Cache__Redis__Password", redis.Password)
            .WithEnvironment("Cache__Redis__Secure", redis.Secure.ToString().ToLowerInvariant())
            .WithEnvironment("Cache__Redis__InstanceName", redis.InstanceName)
            .WithEnvironment("Messaging__RabbitMQ__Host", rabbit.Host)
            .WithEnvironment("Messaging__RabbitMQ__Port", rabbit.Port.ToString())
            .WithEnvironment("Messaging__RabbitMQ__ManagementPort", rabbit.ManagementPort.ToString())
            .WithEnvironment("Messaging__RabbitMQ__VirtualHost", rabbit.VirtualHost)
            .WithEnvironment("Messaging__RabbitMQ__Exchange", exchange)
            .WithEnvironment("Messaging__RabbitMQ__UserName", rabbit.UserName)
            .WithEnvironment("Messaging__RabbitMQ__Password", rabbit.Password)
            .WithEnvironment("Messaging__RabbitMQ__AutoProvision", rabbit.AutoProvision.ToString().ToLowerInvariant())
            .WithEnvironment("Messaging__RabbitMQ__Durable", rabbit.Durable.ToString().ToLowerInvariant())
            .WithEnvironment("Messaging__RabbitMQ__UseQuorumQueues", rabbit.UseQuorumQueues.ToString().ToLowerInvariant())
            .WithEnvironment("Messaging__RabbitMQ__AutoPurgeOnStartup", rabbit.AutoPurgeOnStartup.ToString().ToLowerInvariant())
            .WithEnvironment("Services__Identity__HttpPort", "5001")
            .WithEnvironment("Services__Farm__HttpPort", "5002")
            .WithEnvironment("Services__SensorIngest__HttpPort", "5003")
            .WithEnvironment("Services__AnalyticsWorker__HttpPort", "5004")
            .WithEnvironment("Services__Dashboard__HttpPort", "5005")
            .WithEnvironment("Auth__Jwt__Issuer", configuration["Auth:Jwt:Issuer"] ?? "tc-agro-identity-service")
            .WithEnvironment("Auth__Jwt__Audience__0", configuration["Auth:Jwt:Audience:0"] ?? "tc-agro-identity-service")
            .WithEnvironment("Auth__Jwt__Audience__1", configuration["Auth:Jwt:Audience:1"] ?? "tc-agro-farm-service")
            .WithEnvironment("Auth__Jwt__Audience__2", configuration["Auth:Jwt:Audience:2"] ?? "tc-agro-sensor-ingest-service")
            .WithEnvironment("Auth__Jwt__Audience__3", configuration["Auth:Jwt:Audience:3"] ?? "tc-agro-analytics-worker")
            .WithEnvironment("Auth__Jwt__Audience__4", configuration["Auth:Jwt:Audience:4"] ?? "tc-agro-dashboard-service")
            .WithEnvironment("Auth__Jwt__SecretKey", configuration["Auth:Jwt:SecretKey"] ?? "your-256-bit-secret-key-change-in-production-12345678901234567890")
            .WithEnvironment("Auth__Jwt__ExpirationInMinutes", configuration["Auth:Jwt:ExpirationInMinutes"] ?? "480")
            .WithEnvironment("Logging__LogLevel__Default", configuration["Logging:LogLevel:Default"] ?? "Information")
            .WithEnvironment("Logging__LogLevel__Microsoft_AspNetCore", configuration["Logging:LogLevel:Microsoft_AspNetCore"] ?? "Warning")
            .WithEnvironment("Logging__LogLevel__System", configuration["Logging:LogLevel:System"] ?? "Warning")
            .WithEnvironment("OpenAI__Enabled", configuration["OpenAI:Enabled"] ?? "true")
            .WithEnvironment("OpenAI__BaseUrl", configuration["OpenAI:BaseUrl"] ?? "https://api.openai.com/")
            .WithEnvironment("OpenAI__Model", configuration["OpenAI:Model"] ?? "gpt-4o-mini")
            .WithEnvironment("OpenAI__Temperature", configuration["OpenAI:Temperature"] ?? "0.3")
            .WithEnvironment("OpenAI__MaxSuggestions", configuration["OpenAI:MaxSuggestions"] ?? "15")
            .WithEnvironment("OpenAI__TimeoutSeconds", configuration["OpenAI:TimeoutSeconds"] ?? "60")
            .WithEnvironment("OpenAI__ApiKey", configuration["OpenAI:ApiKey"] ?? string.Empty)
            .WithEnvironment("WeatherProvider__BaseUrl", configuration["WeatherProvider:BaseUrl"] ?? "https://api.open-meteo.com")
            .WithEnvironment("WeatherProvider__Latitude", configuration["WeatherProvider:Latitude"] ?? "-22.7256")
            .WithEnvironment("WeatherProvider__Longitude", configuration["WeatherProvider:Longitude"] ?? "-47.6492")
            .WithEnvironment("WeatherProvider__MaxCoordinatesPerRequest", configuration["WeatherProvider:MaxCoordinatesPerRequest"] ?? "50")
            .WithEnvironment("Jobs__SensorReadings__Enabled", configuration["Jobs:SensorReadings:Enabled"] ?? "true")
            .WithEnvironment("Jobs__SensorReadings__IntervalSeconds", configuration["Jobs:SensorReadings:IntervalSeconds"] ?? "15")
            .WithEnvironment("Alerts__Thresholds__MaxTemperature", configuration["Alerts:Thresholds:MaxTemperature"] ?? "35")
            .WithEnvironment("Alerts__Thresholds__MinSoilMoisture", configuration["Alerts:Thresholds:MinSoilMoisture"] ?? "30")
            .WithEnvironment("Alerts__Thresholds__MinBatteryLevel", configuration["Alerts:Thresholds:MinBatteryLevel"] ?? "20")
            .WithEnvironment("Networking__ForwardedHeaders__Enabled", configuration["Networking:ForwardedHeaders:Enabled"] ?? "true")
            .WithEnvironment("Networking__ForwardedHeaders__KnownProxies__0", configuration["Networking:ForwardedHeaders:KnownProxies:0"] ?? "10.0.0.1")
            .WithEnvironment("Telemetry__Grafana__Agent__Host", configuration["Telemetry:Grafana:Agent:Host"] ?? "otel-collector")
            .WithEnvironment("Telemetry__Grafana__Agent__OtlpGrpcPort", configuration["Telemetry:Grafana:Agent:OtlpGrpcPort"] ?? "4317")
            .WithEnvironment("Telemetry__Grafana__Agent__OtlpHttpPort", configuration["Telemetry:Grafana:Agent:OtlpHttpPort"] ?? "4318")
            .WithEnvironment("Telemetry__Grafana__Agent__MetricsPort", configuration["Telemetry:Grafana:Agent:MetricsPort"] ?? "12345")
            .WithEnvironment("Telemetry__Grafana__Agent__Enabled", configuration["Telemetry:Grafana:Agent:Enabled"] ?? "true")
            .WithEnvironment("Telemetry__Grafana__Otlp__Endpoint", configuration["Telemetry:Grafana:Otlp:Endpoint"] ?? "http://localhost:4318")
            .WithEnvironment("Telemetry__Grafana__Otlp__Protocol", configuration["Telemetry:Grafana:Otlp:Protocol"] ?? "http/protobuf")
            .WithEnvironment("Telemetry__Grafana__Otlp__TimeoutSeconds", configuration["Telemetry:Grafana:Otlp:TimeoutSeconds"] ?? "10")
            .WithEnvironment("Telemetry__Grafana__Otlp__Insecure", configuration["Telemetry:Grafana:Otlp:Insecure"] ?? "true");

        var sslMode = postgres.SslMode;
        if (!string.IsNullOrWhiteSpace(sslMode))
        {
            project.WithEnvironment("Database__Postgres__SslMode", sslMode);
        }

        if (postgres.TrustServerCertificate.HasValue)
        {
            project.WithEnvironment(
                "Database__Postgres__TrustServerCertificate",
                postgres.TrustServerCertificate.Value.ToString().ToLowerInvariant());
        }
    }
}
