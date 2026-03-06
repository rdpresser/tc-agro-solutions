using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;
using Testcontainers.PostgreSql;
using Testcontainers.RabbitMq;
using Testcontainers.Redis;
using AnalyticsProgram = TC.Agro.Analytics.Service.Program;
using FarmProgram = TC.Agro.Farm.Service.Program;
using IdentityProgram = TC.Agro.Identity.Service.Program;
using SensorIngestEntryPoint = TC.Agro.SensorIngest.Service.Program;

namespace TC.Agro.Integration.Tests.Abstractions;

public sealed class CrossServiceIntegrationFixture : IAsyncLifetime
{
    private const string IdentityDatabase = "tc-agro-identity-db";
    private const string FarmDatabase = "tc-agro-farm-db";
    private const string SensorIngestDatabase = "tc-agro-sensor-ingest-db";
    private const string AnalyticsDatabase = "tc-agro-analytics-db";
    private const string PostgresUserName = "postgres";
    private const string PostgresPassword = "postgres";

    private readonly PostgreSqlContainer _postgresContainer = new PostgreSqlBuilder("timescale/timescaledb:latest-pg17")
        .WithDatabase("postgres")
        .WithUsername(PostgresUserName)
        .WithPassword(PostgresPassword)
        .WithPortBinding(5432, true)
        .Build();

    private readonly RabbitMqContainer _rabbitMqContainer = new RabbitMqBuilder("rabbitmq:4.2.3-management-alpine")
        .WithUsername("guest")
        .WithPassword("guest")
        .WithPortBinding(5672, true)
        .WithPortBinding(15672, true)
        .Build();

    private readonly RedisContainer _redisContainer = new RedisBuilder("redis:8.4.0-alpine")
        .WithPortBinding(6379, true)
        .Build();

    private readonly List<string> _managedEnvironmentVariables =
    [
        "ASPNETCORE_ENVIRONMENT",
        "Database__Postgres__Host",
        "Database__Postgres__Port",
        "Database__Postgres__UserName",
        "Database__Postgres__Password",
        "Database__Postgres__Schema",
        "Database__Postgres__ConnectionTimeout",
        "Database__Postgres__MinPoolSize",
        "Database__Postgres__MaxPoolSize",
        "Cache__Redis__Host",
        "Cache__Redis__Port",
        "Cache__Redis__Password",
        "Cache__Redis__InstanceName",
        "Messaging__RabbitMQ__Host",
        "Messaging__RabbitMQ__Port",
        "Messaging__RabbitMQ__ManagementPort",
        "Messaging__RabbitMQ__VirtualHost",
        "Messaging__RabbitMQ__UserName",
        "Messaging__RabbitMQ__Password",
        "Messaging__RabbitMQ__AutoProvision",
        "Messaging__RabbitMQ__AutoPurgeOnStartup",
        "Messaging__RabbitMQ__UseQuorumQueues",
        "Jobs__SensorReadings__Enabled",
        "Telemetry__Grafana__Agent__Enabled"
    ];

    public WebApplicationFactory<IdentityProgram> IdentityFactory { get; private set; } = default!;
    public WebApplicationFactory<FarmProgram> FarmFactory { get; private set; } = default!;
    public WebApplicationFactory<SensorIngestEntryPoint> SensorIngestFactory { get; private set; } = default!;
    public WebApplicationFactory<AnalyticsProgram> AnalyticsFactory { get; private set; } = default!;

    public HttpClient IdentityClient { get; private set; } = default!;
    public HttpClient FarmClient { get; private set; } = default!;
    public HttpClient SensorIngestClient { get; private set; } = default!;
    public HttpClient AnalyticsClient { get; private set; } = default!;

    public async ValueTask InitializeAsync()
    {
        await _postgresContainer.StartAsync().ConfigureAwait(false);
        await _rabbitMqContainer.StartAsync().ConfigureAwait(false);
        await _redisContainer.StartAsync().ConfigureAwait(false);

        await EnsureDatabaseExistsAsync(IdentityDatabase).ConfigureAwait(false);
        await EnsureDatabaseExistsAsync(FarmDatabase).ConfigureAwait(false);
        await EnsureDatabaseExistsAsync(SensorIngestDatabase).ConfigureAwait(false);
        await EnsureDatabaseExistsAsync(AnalyticsDatabase).ConfigureAwait(false);

        ConfigureEnvironment();

        IdentityFactory = new WebApplicationFactory<IdentityProgram>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"));

        FarmFactory = new WebApplicationFactory<FarmProgram>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"));

        SensorIngestFactory = new WebApplicationFactory<SensorIngestEntryPoint>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"));

        AnalyticsFactory = new WebApplicationFactory<AnalyticsProgram>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"));

        FarmClient = FarmFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        IdentityClient = IdentityFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        SensorIngestClient = SensorIngestFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        AnalyticsClient = AnalyticsFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        await WaitForHealthAsync(IdentityClient, "identity").ConfigureAwait(false);
        await WaitForHealthAsync(FarmClient, "farm").ConfigureAwait(false);
        await WaitForHealthAsync(SensorIngestClient, "sensor-ingest").ConfigureAwait(false);
        await WaitForHealthAsync(AnalyticsClient, "analytics").ConfigureAwait(false);
    }

    public async ValueTask DisposeAsync()
    {
        IdentityClient?.Dispose();
        FarmClient?.Dispose();
        SensorIngestClient?.Dispose();
        AnalyticsClient?.Dispose();

        await TryDisposeFactoryAsync(IdentityFactory).ConfigureAwait(false);
        await TryDisposeFactoryAsync(FarmFactory).ConfigureAwait(false);
        await TryDisposeFactoryAsync(SensorIngestFactory).ConfigureAwait(false);
        await TryDisposeFactoryAsync(AnalyticsFactory).ConfigureAwait(false);

        foreach (var variableName in _managedEnvironmentVariables)
        {
            Environment.SetEnvironmentVariable(variableName, null);
        }

        await _redisContainer.DisposeAsync().ConfigureAwait(false);
        await _rabbitMqContainer.DisposeAsync().ConfigureAwait(false);
        await _postgresContainer.DisposeAsync().ConfigureAwait(false);
    }

    private static async Task TryDisposeFactoryAsync<TEntryPoint>(WebApplicationFactory<TEntryPoint>? factory)
        where TEntryPoint : class
    {
        if (factory is null)
        {
            return;
        }

        try
        {
            await factory.DisposeAsync().ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            //
        }
    }

    public Task<OwnerSnapshotRow?> WaitForOwnerSnapshotAsync(Guid ownerId, TimeSpan timeout, CancellationToken cancellationToken = default)
        => WaitForFarmOwnerSnapshotAsync(ownerId, timeout, predicate: null, cancellationToken);

    public Task<OwnerSnapshotRow?> WaitForFarmOwnerSnapshotAsync(
        Guid ownerId,
        TimeSpan timeout,
        Func<OwnerSnapshotRow, bool>? predicate = null,
        CancellationToken cancellationToken = default)
        => WaitForRowAsync(
            ct => TryGetOwnerSnapshotAsync(FarmDatabase, ownerId, ct),
            timeout,
            predicate,
            cancellationToken);

    public Task<OwnerSnapshotRow?> WaitForSensorIngestOwnerSnapshotAsync(
        Guid ownerId,
        TimeSpan timeout,
        Func<OwnerSnapshotRow, bool>? predicate = null,
        CancellationToken cancellationToken = default)
        => WaitForRowAsync(
            ct => TryGetOwnerSnapshotAsync(SensorIngestDatabase, ownerId, ct),
            timeout,
            predicate,
            cancellationToken);

    public Task<OwnerSnapshotRow?> WaitForAnalyticsOwnerSnapshotAsync(
        Guid ownerId,
        TimeSpan timeout,
        Func<OwnerSnapshotRow, bool>? predicate = null,
        CancellationToken cancellationToken = default)
        => WaitForRowAsync(
            ct => TryGetOwnerSnapshotAsync(AnalyticsDatabase, ownerId, ct),
            timeout,
            predicate,
            cancellationToken);

    public Task<SensorSnapshotRow?> WaitForSensorIngestSensorSnapshotAsync(
        Guid sensorId,
        TimeSpan timeout,
        Func<SensorSnapshotRow, bool>? predicate = null,
        CancellationToken cancellationToken = default)
        => WaitForRowAsync(
            ct => TryGetSensorSnapshotAsync(SensorIngestDatabase, sensorId, ct),
            timeout,
            predicate,
            cancellationToken);

    public Task<SensorSnapshotRow?> WaitForAnalyticsSensorSnapshotAsync(
        Guid sensorId,
        TimeSpan timeout,
        Func<SensorSnapshotRow, bool>? predicate = null,
        CancellationToken cancellationToken = default)
        => WaitForRowAsync(
            ct => TryGetSensorSnapshotAsync(AnalyticsDatabase, sensorId, ct),
            timeout,
            predicate,
            cancellationToken);

    public Task<AlertRow?> WaitForAnalyticsAlertAsync(
        Guid sensorId,
        TimeSpan timeout,
        Func<AlertRow, bool>? predicate = null,
        CancellationToken cancellationToken = default)
        => WaitForRowAsync(
            ct => TryGetLatestAlertAsync(sensorId, ct),
            timeout,
            predicate,
            cancellationToken);

    public async Task<int> GetAnalyticsAlertCountAsync(Guid sensorId, CancellationToken cancellationToken = default)
    {
        var analyticsConnectionString = BuildPostgresConnectionString(AnalyticsDatabase);

        await using var connection = new NpgsqlConnection(analyticsConnectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var command = new NpgsqlCommand(
            """
            SELECT COUNT(*)
            FROM public.alerts
            WHERE sensor_id = @sensorId;
            """,
            connection);

        command.Parameters.AddWithValue("sensorId", sensorId);

        var result = await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);
        return result is int intResult ? intResult : Convert.ToInt32(result);
    }

    private static async Task<T?> WaitForRowAsync<T>(
        Func<CancellationToken, Task<T?>> queryAsync,
        TimeSpan timeout,
        Func<T, bool>? predicate,
        CancellationToken cancellationToken)
        where T : class
    {
        var deadline = DateTimeOffset.UtcNow + timeout;

        while (DateTimeOffset.UtcNow < deadline)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var row = await queryAsync(cancellationToken).ConfigureAwait(false);
            if (row is not null && (predicate is null || predicate(row)))
            {
                return row;
            }

            await Task.Delay(TimeSpan.FromMilliseconds(500), cancellationToken).ConfigureAwait(false);
        }

        return null;
    }

    private void ConfigureEnvironment()
    {
        SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Development");

        SetEnvironmentVariable("Database__Postgres__Host", _postgresContainer.Hostname);
        SetEnvironmentVariable("Database__Postgres__Port", _postgresContainer.GetMappedPublicPort(5432).ToString());
        SetEnvironmentVariable("Database__Postgres__UserName", PostgresUserName);
        SetEnvironmentVariable("Database__Postgres__Password", PostgresPassword);
        SetEnvironmentVariable("Database__Postgres__Schema", "public");
        SetEnvironmentVariable("Database__Postgres__ConnectionTimeout", "30");
        SetEnvironmentVariable("Database__Postgres__MinPoolSize", "2");
        SetEnvironmentVariable("Database__Postgres__MaxPoolSize", "20");

        SetEnvironmentVariable("Cache__Redis__Host", _redisContainer.Hostname);
        SetEnvironmentVariable("Cache__Redis__Port", _redisContainer.GetMappedPublicPort(6379).ToString());
        SetEnvironmentVariable("Cache__Redis__Password", string.Empty);
        SetEnvironmentVariable("Cache__Redis__InstanceName", "tc-agro-integration-tests");

        SetEnvironmentVariable("Messaging__RabbitMQ__Host", _rabbitMqContainer.Hostname);
        SetEnvironmentVariable("Messaging__RabbitMQ__Port", _rabbitMqContainer.GetMappedPublicPort(5672).ToString());
        SetEnvironmentVariable("Messaging__RabbitMQ__ManagementPort", _rabbitMqContainer.GetMappedPublicPort(15672).ToString());
        SetEnvironmentVariable("Messaging__RabbitMQ__VirtualHost", "/");
        SetEnvironmentVariable("Messaging__RabbitMQ__UserName", "guest");
        SetEnvironmentVariable("Messaging__RabbitMQ__Password", "guest");
        SetEnvironmentVariable("Messaging__RabbitMQ__AutoProvision", "true");
        SetEnvironmentVariable("Messaging__RabbitMQ__AutoPurgeOnStartup", "true");
        SetEnvironmentVariable("Messaging__RabbitMQ__UseQuorumQueues", "false");

        SetEnvironmentVariable("Jobs__SensorReadings__Enabled", "false");

        SetEnvironmentVariable("Telemetry__Grafana__Agent__Enabled", "false");
    }

    private async Task EnsureDatabaseExistsAsync(string databaseName)
    {
        var maintenanceConnectionString = BuildPostgresConnectionString("postgres");
        await using var connection = new NpgsqlConnection(maintenanceConnectionString);
        await connection.OpenAsync().ConfigureAwait(false);

        await using var existsCommand = new NpgsqlCommand(
            "SELECT 1 FROM pg_database WHERE datname = @dbName;",
            connection);

        existsCommand.Parameters.AddWithValue("dbName", databaseName);

        var exists = await existsCommand.ExecuteScalarAsync().ConfigureAwait(false) is not null;
        if (exists)
        {
            return;
        }

        await using var createCommand = new NpgsqlCommand($"CREATE DATABASE \"{databaseName}\";", connection);
        await createCommand.ExecuteNonQueryAsync().ConfigureAwait(false);
    }

    private static async Task WaitForHealthAsync(HttpClient client, string serviceName)
    {
        var timeout = TimeSpan.FromSeconds(60);
        var startedAt = DateTimeOffset.UtcNow;

        while (DateTimeOffset.UtcNow - startedAt < timeout)
        {
            try
            {
                var response = await client.GetAsync("/health").ConfigureAwait(false);
                if (response.IsSuccessStatusCode)
                {
                    return;
                }
            }
            catch
            {
                // keep retrying
            }

            await Task.Delay(TimeSpan.FromMilliseconds(500)).ConfigureAwait(false);
        }

        throw new TimeoutException($"Timed out waiting for {serviceName} health endpoint.");
    }

    private async Task<OwnerSnapshotRow?> TryGetOwnerSnapshotAsync(string databaseName, Guid ownerId, CancellationToken cancellationToken)
    {
        var connectionString = BuildPostgresConnectionString(databaseName);

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var command = new NpgsqlCommand(
            """
            SELECT id, name, email, is_active
            FROM public.owner_snapshots
            WHERE id = @ownerId;
            """,
            connection);

        command.Parameters.AddWithValue("ownerId", ownerId);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        var hasRow = await reader.ReadAsync(cancellationToken).ConfigureAwait(false);
        if (!hasRow)
        {
            return null;
        }

        return new OwnerSnapshotRow(
            Id: reader.GetGuid(0),
            Name: reader.GetString(1),
            Email: reader.GetString(2),
            IsActive: reader.GetBoolean(3));
    }

    private async Task<SensorSnapshotRow?> TryGetSensorSnapshotAsync(string databaseName, Guid sensorId, CancellationToken cancellationToken)
    {
        var connectionString = BuildPostgresConnectionString(databaseName);

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var command = new NpgsqlCommand(
            """
            SELECT id, owner_id, property_id, plot_id, label, status, is_active, status_change_reason
            FROM public.sensor_snapshots
            WHERE id = @sensorId;
            """,
            connection);

        command.Parameters.AddWithValue("sensorId", sensorId);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        var hasRow = await reader.ReadAsync(cancellationToken).ConfigureAwait(false);
        if (!hasRow)
        {
            return null;
        }

        return new SensorSnapshotRow(
            Id: reader.GetGuid(0),
            OwnerId: reader.GetGuid(1),
            PropertyId: reader.GetGuid(2),
            PlotId: reader.GetGuid(3),
            Label: await reader.IsDBNullAsync(4).ConfigureAwait(false) ? null : reader.GetString(4),
            Status: reader.GetString(5),
            IsActive: reader.GetBoolean(6),
            StatusChangeReason: await reader.IsDBNullAsync(7).ConfigureAwait(false) ? null : reader.GetString(7));
    }

    private async Task<AlertRow?> TryGetLatestAlertAsync(Guid sensorId, CancellationToken cancellationToken)
    {
        var analyticsConnectionString = BuildPostgresConnectionString(AnalyticsDatabase);

        await using var connection = new NpgsqlConnection(analyticsConnectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var command = new NpgsqlCommand(
            """
            SELECT id, sensor_id, type, severity, status, message, value, threshold, created_at
            FROM public.alerts
            WHERE sensor_id = @sensorId
            ORDER BY created_at DESC
            LIMIT 1;
            """,
            connection);

        command.Parameters.AddWithValue("sensorId", sensorId);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        var hasRow = await reader.ReadAsync(cancellationToken).ConfigureAwait(false);
        if (!hasRow)
        {
            return null;
        }

        return new AlertRow(
            Id: reader.GetGuid(0),
            SensorId: reader.GetGuid(1),
            Type: reader.GetString(2),
            Severity: reader.GetString(3),
            Status: reader.GetString(4),
            Message: reader.GetString(5),
            Value: reader.GetDouble(6),
            Threshold: reader.GetDouble(7),
            CreatedAt: await reader.GetFieldValueAsync<DateTimeOffset>(8).ConfigureAwait(false));
    }

    private string BuildPostgresConnectionString(string database)
    {
        var builder = new NpgsqlConnectionStringBuilder(_postgresContainer.GetConnectionString())
        {
            Database = database
        };

        return builder.ConnectionString;
    }

    private static void SetEnvironmentVariable(string key, string value)
    {
        Environment.SetEnvironmentVariable(key, value);
    }

    public sealed record OwnerSnapshotRow(Guid Id, string Name, string Email, bool IsActive);
    public sealed record SensorSnapshotRow(
        Guid Id,
        Guid OwnerId,
        Guid PropertyId,
        Guid PlotId,
        string? Label,
        string Status,
        bool IsActive,
        string? StatusChangeReason);
    public sealed record AlertRow(
        Guid Id,
        Guid SensorId,
        string Type,
        string Severity,
        string Status,
        string Message,
        double Value,
        double Threshold,
        DateTimeOffset CreatedAt);
}