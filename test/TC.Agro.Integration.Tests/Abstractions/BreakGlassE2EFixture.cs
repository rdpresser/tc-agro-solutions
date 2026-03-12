using System.Diagnostics;
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

/// <summary>
/// Instrumentation helper for fixture lifecycle diagnostics.
/// Logs timing information for all major operations to help identify bottlenecks.
/// </summary>
file class FixtureInstrumentation
{
    private readonly Stopwatch _watch = new();

    public void Start(string operation)
    {
        _watch.Restart();
        Console.WriteLine($"[FIXTURE] ▶ START {operation}");
    }

    public void Done(string operation, string? details = null)
    {
        _watch.Stop();
        var suffix = !string.IsNullOrEmpty(details) ? $" | {details}" : string.Empty;
        Console.WriteLine($"[FIXTURE] ✓ DONE  {operation} ({_watch.ElapsedMilliseconds}ms){suffix}");
    }

    public void Error(string operation, Exception ex)
    {
        _watch.Stop();
        Console.WriteLine($"[FIXTURE] ✗ ERROR {operation} ({_watch.ElapsedMilliseconds}ms): {ex.GetType().Name}: {ex.Message}");
    }
}

/// <summary>
/// Cross-service fixture focused on end-to-end reliability and traceability.
/// It keeps infrastructure containers shared for the suite and resets service state per test.
/// </summary>
public class BreakGlassE2EFixture : IAsyncLifetime
{
    protected const string IdentityDatabase = "tc-agro-identity-db";
    protected const string FarmDatabase = "tc-agro-farm-db";
    protected const string SensorIngestDatabase = "tc-agro-sensor-ingest-db";
    protected const string AnalyticsDatabase = "tc-agro-analytics-db";

    private const string PostgresUserName = "postgres";
    private const string PostgresPassword = "postgres";
    private const int PostgresConnectionTimeoutSeconds = 15;
    private const int SqlCommandTimeoutSeconds = 10;

    private static readonly TimeSpan FixtureInitializationTimeout = TimeSpan.FromMinutes(3);
    private static readonly TimeSpan InfrastructureStartupTimeout = TimeSpan.FromSeconds(90);
    private static readonly TimeSpan PerDatabaseBootstrapTimeout = TimeSpan.FromSeconds(20);
    private static readonly TimeSpan PerFactoryDisposeTimeout = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan PerContainerDisposeTimeout = TimeSpan.FromSeconds(45);

    private static readonly string[] ManagedDatabases =
    [
        IdentityDatabase,
        FarmDatabase,
        SensorIngestDatabase,
        AnalyticsDatabase
    ];

    private static readonly string[] ConsumerDatabases =
    [
        FarmDatabase,
        SensorIngestDatabase,
        AnalyticsDatabase
    ];

    private static readonly string[] ResetSchemas =
    [
        "public"
    ];

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
        "Jobs__SensorReadings__IntervalSeconds",
        "Telemetry__Grafana__Agent__Enabled"
    ];

    protected virtual bool EnableSensorReadingsJob => false;

    protected virtual int SensorReadingsJobIntervalSeconds => 30;

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
        var instrumentation = new FixtureInstrumentation();

        try
        {
            instrumentation.Start("Initialize: Infrastructure Containers (timeout 90s)");
            await Task.WhenAll(
                _postgresContainer.StartAsync(),
                _rabbitMqContainer.StartAsync(),
                _redisContainer.StartAsync())
                .WaitAsync(InfrastructureStartupTimeout)
                .ConfigureAwait(false);
            instrumentation.Done("Initialize: Infrastructure Containers");

            instrumentation.Start("Initialize: Managed Databases");
            foreach (var database in ManagedDatabases)
            {
                await EnsureDatabaseExistsAsync(database)
                    .WaitAsync(PerDatabaseBootstrapTimeout)
                    .ConfigureAwait(false);
            }
            instrumentation.Done("Initialize: Managed Databases");

            instrumentation.Start("Initialize: Environment Configuration");
            ConfigureEnvironment();
            instrumentation.Done("Initialize: Environment Configuration");

            instrumentation.Start("Initialize: Service Factories");
            IdentityFactory = CreateFactory<IdentityProgram>();
            FarmFactory = CreateFactory<FarmProgram>();
            SensorIngestFactory = CreateFactory<SensorIngestEntryPoint>();
            AnalyticsFactory = CreateFactory<AnalyticsProgram>();
            instrumentation.Done("Initialize: Service Factories");

            instrumentation.Start("Initialize: HTTP Clients");
            IdentityClient = CreateClient(IdentityFactory);
            FarmClient = CreateClient(FarmFactory);
            SensorIngestClient = CreateClient(SensorIngestFactory);
            AnalyticsClient = CreateClient(AnalyticsFactory);
            instrumentation.Done("Initialize: HTTP Clients");

            instrumentation.Start("Initialize: Health Checks (4 services × 30s timeout, overall 3m)");
            using var healthChecksCts = new CancellationTokenSource(FixtureInitializationTimeout);

            await WaitForHealthAsync(IdentityClient, "identity", healthChecksCts.Token).ConfigureAwait(false);
            await WaitForHealthAsync(FarmClient, "farm", healthChecksCts.Token).ConfigureAwait(false);
            await WaitForHealthAsync(SensorIngestClient, "sensor-ingest", healthChecksCts.Token).ConfigureAwait(false);
            await WaitForHealthAsync(AnalyticsClient, "analytics", healthChecksCts.Token).ConfigureAwait(false);
            instrumentation.Done("Initialize: Health Checks");
        }
        catch (TimeoutException ex)
        {
            instrumentation.Error("Initialize: TIMEOUT - operation exceeded deadline", ex);
            throw new InvalidOperationException(
                "Fixture initialization exceeded timeout. " +
                "Check service startup logs and container health. " +
                "Possible causes: services not booting, database migration hung, health check endpoint unreachable.",
                ex);
        }
        catch (OperationCanceledException ex)
        {
            instrumentation.Error("Initialize: CANCELED - operation exceeded deadline", ex);
            throw new InvalidOperationException(
                "Fixture initialization was canceled due to timeout. " +
                "Check service startup logs and container health.",
                ex);
        }
    }

    public async ValueTask DisposeAsync()
    {
        var instrumentation = new FixtureInstrumentation();

        try
        {
            // Phase 1: Dispose HTTP clients (should be quick)
            instrumentation.Start("Dispose: HTTP Clients");
            IdentityClient?.Dispose();
            FarmClient?.Dispose();
            SensorIngestClient?.Dispose();
            AnalyticsClient?.Dispose();
            instrumentation.Done("Dispose: HTTP Clients");

            // Phase 2: Dispose factories (may take time as they shut down the ASP.NET apps)
            // Use a timeout to prevent hangs during factory disposal
            instrumentation.Start("Dispose: Web Application Factories");

            await TryDisposeFactoryAsync(IdentityFactory, "identity-service", PerFactoryDisposeTimeout).ConfigureAwait(false);
            await TryDisposeFactoryAsync(FarmFactory, "farm-service", PerFactoryDisposeTimeout).ConfigureAwait(false);
            await TryDisposeFactoryAsync(SensorIngestFactory, "sensor-ingest-service", PerFactoryDisposeTimeout).ConfigureAwait(false);
            await TryDisposeFactoryAsync(AnalyticsFactory, "analytics-service", PerFactoryDisposeTimeout).ConfigureAwait(false);

            instrumentation.Done("Dispose: Web Application Factories");

            // Phase 3: Clear environment variables (quick)
            instrumentation.Start("Dispose: Environment Variables");
            foreach (var variableName in _managedEnvironmentVariables)
            {
                Environment.SetEnvironmentVariable(variableName, null);
            }
            instrumentation.Done("Dispose: Environment Variables");

            // Phase 4: Dispose infrastructure containers
            instrumentation.Start("Dispose: Redis Container");
            try
            {
                await _redisContainer.DisposeAsync()
                    .AsTask()
                    .WaitAsync(PerContainerDisposeTimeout)
                    .ConfigureAwait(false);
            }
            catch (TimeoutException)
            {
                Console.WriteLine($"[FIXTURE.Dispose] ⚠ redis container disposal exceeded {PerContainerDisposeTimeout.TotalSeconds}s. Continuing cleanup.");
            }
            instrumentation.Done("Dispose: Redis Container");

            instrumentation.Start("Dispose: RabbitMQ Container");
            try
            {
                await _rabbitMqContainer.DisposeAsync()
                    .AsTask()
                    .WaitAsync(PerContainerDisposeTimeout)
                    .ConfigureAwait(false);
            }
            catch (TimeoutException)
            {
                Console.WriteLine($"[FIXTURE.Dispose] ⚠ rabbitmq container disposal exceeded {PerContainerDisposeTimeout.TotalSeconds}s. Continuing cleanup.");
            }
            instrumentation.Done("Dispose: RabbitMQ Container");

            instrumentation.Start("Dispose: PostgreSQL Container");
            try
            {
                await _postgresContainer.DisposeAsync()
                    .AsTask()
                    .WaitAsync(PerContainerDisposeTimeout)
                    .ConfigureAwait(false);
            }
            catch (TimeoutException)
            {
                Console.WriteLine($"[FIXTURE.Dispose] ⚠ postgres container disposal exceeded {PerContainerDisposeTimeout.TotalSeconds}s. Continuing cleanup.");
            }
            instrumentation.Done("Dispose: PostgreSQL Container");

            Console.WriteLine("[FIXTURE] ✓ All cleanup phases completed successfully");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FIXTURE] ✗ ERROR during disposal: {ex.GetType().Name}: {ex.Message}");
            throw;
        }
    }

    public async Task ResetStateAsync(CancellationToken cancellationToken = default)
    {
        var instrumentation = new FixtureInstrumentation();
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(30)); // Per-test reset must complete within 30s

        try
        {
            instrumentation.Start("ResetState: Schema Truncation");
            foreach (var database in ManagedDatabases)
            {
                await TruncateSchemasAsync(database, ResetSchemas, timeoutCts.Token).ConfigureAwait(false);
            }
            instrumentation.Done("ResetState: Schema Truncation");

            instrumentation.Start("ResetState: Redis Flush");
            await FlushRedisAsync(timeoutCts.Token).ConfigureAwait(false);
            instrumentation.Done("ResetState: Redis Flush");
        }
        catch (OperationCanceledException ex)
        {
            instrumentation.Error("ResetState: TIMEOUT - reset exceeded 30 seconds", ex);
            throw new InvalidOperationException(
                "Per-test state reset timed out after 30 seconds. " +
                "Check database lock status and Redis connectivity.",
                ex);
        }
    }

    public async Task DeleteOwnerSnapshotsFromConsumersAsync(Guid ownerId, CancellationToken cancellationToken = default)
    {
        foreach (var database in ConsumerDatabases)
        {
            var connectionString = BuildPostgresConnectionString(database);

            await using var connection = new NpgsqlConnection(connectionString);
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

            await using var command = new NpgsqlCommand(
                "DELETE FROM public.owner_snapshots WHERE id = @ownerId;",
                connection);

            command.Parameters.AddWithValue("ownerId", ownerId);

            await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
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


    public async Task<bool> WaitForAnalyticsAlertCountAsync(
        Guid sensorId,
        int expectedCount,
        TimeSpan timeout,
        CancellationToken cancellationToken = default)
    {
        var deadline = DateTimeOffset.UtcNow + timeout;

        while (DateTimeOffset.UtcNow < deadline)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var count = await GetAnalyticsAlertCountAsync(sensorId, cancellationToken).ConfigureAwait(false);
            if (count >= expectedCount)
            {
                return true;
            }

            await Task.Delay(TimeSpan.FromSeconds(1), cancellationToken).ConfigureAwait(false);
        }

        return false;
    }

    public async Task<bool> WaitForSensorReadingsAsync(
        Guid sensorId,
        int minCount,
        TimeSpan timeout,
        CancellationToken cancellationToken = default)
    {
        var deadline = DateTimeOffset.UtcNow + timeout;

        while (DateTimeOffset.UtcNow < deadline)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var count = await GetSensorIngestReadingCountAsync(sensorId, cancellationToken).ConfigureAwait(false);
            if (count >= minCount)
            {
                return true;
            }

            await Task.Delay(TimeSpan.FromSeconds(1), cancellationToken).ConfigureAwait(false);
        }

        return false;
    }

    public async Task<int> GetSensorIngestReadingCountAsync(Guid sensorId, CancellationToken cancellationToken = default)
    {
        var connectionString = BuildPostgresConnectionString(SensorIngestDatabase);

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var command = new NpgsqlCommand(
            "SELECT COUNT(*) FROM public.sensor_readings WHERE sensor_id = @sensorId;",
            connection);

        command.Parameters.AddWithValue("sensorId", sensorId);

        var result = await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);
        return result is long l ? (int)l : Convert.ToInt32(result);
    }

    public async Task<int> GetSensorIngestOutboxPendingCountAsync(CancellationToken cancellationToken = default)
    {
        var connectionString = BuildPostgresConnectionString(SensorIngestDatabase);

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var command = new NpgsqlCommand(
            "SELECT COUNT(*) FROM wolverine.wolverine_outgoing_envelopes;",
            connection);

        var result = await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);
        return result is long l ? (int)l : Convert.ToInt32(result);
    }

    public async Task<bool> WaitForEmptySensorIngestOutboxAsync(
        TimeSpan timeout,
        CancellationToken cancellationToken = default)
    {
        var deadline = DateTimeOffset.UtcNow + timeout;

        while (DateTimeOffset.UtcNow < deadline)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var count = await GetSensorIngestOutboxPendingCountAsync(cancellationToken).ConfigureAwait(false);
            if (count == 0)
            {
                return true;
            }

            await Task.Delay(TimeSpan.FromMilliseconds(500), cancellationToken).ConfigureAwait(false);
        }

        return false;
    }

    public async Task<Guid> EnsureFarmSystemCropCatalogAsync(
        string cropTypeName,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(cropTypeName))
        {
            throw new ArgumentException("Crop type name must be provided.", nameof(cropTypeName));
        }

        var normalizedCropTypeName = cropTypeName.Trim();
        var farmConnectionString = BuildPostgresConnectionString(FarmDatabase);

        await using var connection = new NpgsqlConnection(farmConnectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var existsCommand = new NpgsqlCommand(
            """
            SELECT id
            FROM public.crop_type_catalog
            WHERE lower(name) = lower(@name)
              AND owner_id IS NULL
              AND is_active = true
            ORDER BY created_at
            LIMIT 1;
            """,
            connection);

        existsCommand.Parameters.AddWithValue("name", normalizedCropTypeName);

        var existingResult = await existsCommand.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);
        if (existingResult is Guid existingId)
        {
            return existingId;
        }

        var catalogId = Guid.NewGuid();

        await using var insertCommand = new NpgsqlCommand(
            """
            INSERT INTO public.crop_type_catalog
                (id, name, is_system_defined, created_at, is_active)
            VALUES
                (@id, @name, true, CURRENT_TIMESTAMP, true);
            """,
            connection);

        insertCommand.Parameters.AddWithValue("id", catalogId);
        insertCommand.Parameters.AddWithValue("name", normalizedCropTypeName);

        await insertCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);

        return catalogId;
    }

    private static WebApplicationFactory<TEntryPoint> CreateFactory<TEntryPoint>()
        where TEntryPoint : class
        => new WebApplicationFactory<TEntryPoint>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"));

    private static HttpClient CreateClient<TEntryPoint>(WebApplicationFactory<TEntryPoint> factory)
        where TEntryPoint : class
        => factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

    private static async Task TryDisposeFactoryAsync<TEntryPoint>(
        WebApplicationFactory<TEntryPoint>? factory,
        string serviceName,
        TimeSpan timeout)
        where TEntryPoint : class
    {
        if (factory is null)
        {
            return;
        }

        try
        {
            await factory.DisposeAsync()
                .AsTask()
                .WaitAsync(timeout)
                .ConfigureAwait(false);
            Console.WriteLine($"[FIXTURE.Dispose] ✓ {serviceName} factory disposed cleanly");
        }
        catch (TimeoutException ex)
        {
            Console.WriteLine($"[FIXTURE.Dispose] ⚠ {serviceName} factory disposal exceeded {timeout.TotalSeconds}s and will be skipped");
            Console.WriteLine($"[FIXTURE.Dispose] ⚠ {serviceName} timeout details: {ex.Message}");
            return;
        }
        catch (PostgresException postgresException) when (postgresException.SqlState is "57P01" or "57P02" or "57P03")
        {
            // Expected: Postgres closes connections during host disposal
            Console.WriteLine($"[FIXTURE.Dispose] ⚠ {serviceName} - benign Postgres shutdown ({postgresException.SqlState})");
        }
        catch (Exception ex) when (IsBenignTeardownException(ex))
        {
            // Expected: Infrastructure shutdown races
            Console.WriteLine($"[FIXTURE.Dispose] ⚠ {serviceName} - benign infrastructure exception: {ex.GetType().Name}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FIXTURE.Dispose] ✗ {serviceName} factory disposal error: {ex.GetType().Name}: {ex.Message}");
            throw;
        }
    }

    private static bool IsBenignTeardownException(Exception exception)
    {
        if (exception is PostgresException postgresException)
        {
            return postgresException.SqlState is "57P01" or "57P02" or "57P03";
        }

        if (exception is NpgsqlException npgsqlException && npgsqlException.InnerException is not null)
        {
            return IsBenignTeardownException(npgsqlException.InnerException);
        }

        return exception.InnerException is not null && IsBenignTeardownException(exception.InnerException);
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
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Development");

        Environment.SetEnvironmentVariable("Database__Postgres__Host", _postgresContainer.Hostname);
        Environment.SetEnvironmentVariable("Database__Postgres__Port", _postgresContainer.GetMappedPublicPort(5432).ToString());
        Environment.SetEnvironmentVariable("Database__Postgres__UserName", PostgresUserName);
        Environment.SetEnvironmentVariable("Database__Postgres__Password", PostgresPassword);
        Environment.SetEnvironmentVariable("Database__Postgres__Schema", "public");
        Environment.SetEnvironmentVariable("Database__Postgres__ConnectionTimeout", "30");
        Environment.SetEnvironmentVariable("Database__Postgres__MinPoolSize", "2");
        Environment.SetEnvironmentVariable("Database__Postgres__MaxPoolSize", "20");

        Environment.SetEnvironmentVariable("Cache__Redis__Host", _redisContainer.Hostname);
        Environment.SetEnvironmentVariable("Cache__Redis__Port", _redisContainer.GetMappedPublicPort(6379).ToString());
        Environment.SetEnvironmentVariable("Cache__Redis__Password", string.Empty);
        Environment.SetEnvironmentVariable("Cache__Redis__InstanceName", "tc-agro-integration-tests");

        Environment.SetEnvironmentVariable("Messaging__RabbitMQ__Host", _rabbitMqContainer.Hostname);
        Environment.SetEnvironmentVariable("Messaging__RabbitMQ__Port", _rabbitMqContainer.GetMappedPublicPort(5672).ToString());
        Environment.SetEnvironmentVariable("Messaging__RabbitMQ__ManagementPort", _rabbitMqContainer.GetMappedPublicPort(15672).ToString());
        Environment.SetEnvironmentVariable("Messaging__RabbitMQ__VirtualHost", "/");
        Environment.SetEnvironmentVariable("Messaging__RabbitMQ__UserName", "guest");
        Environment.SetEnvironmentVariable("Messaging__RabbitMQ__Password", "guest");
        Environment.SetEnvironmentVariable("Messaging__RabbitMQ__AutoProvision", "true");
        Environment.SetEnvironmentVariable("Messaging__RabbitMQ__AutoPurgeOnStartup", "true");
        Environment.SetEnvironmentVariable("Messaging__RabbitMQ__UseQuorumQueues", "false");

        Environment.SetEnvironmentVariable("Jobs__SensorReadings__Enabled", EnableSensorReadingsJob ? "true" : "false");
        Environment.SetEnvironmentVariable("Jobs__SensorReadings__IntervalSeconds", SensorReadingsJobIntervalSeconds.ToString());

        Environment.SetEnvironmentVariable("Telemetry__Grafana__Agent__Enabled", "false");
    }

    private async Task EnsureDatabaseExistsAsync(string databaseName)
    {
        var maintenanceConnectionString = BuildPostgresConnectionString("postgres");

        await using var connection = new NpgsqlConnection(maintenanceConnectionString);

        try
        {
            await connection.OpenAsync().ConfigureAwait(false);
        }
        catch (NpgsqlException ex)
        {
            throw new InvalidOperationException(
                $"Failed to connect to PostgreSQL maintenance database: {ex.Message}",
                ex);
        }

        try
        {
            await using var existsCommand = new NpgsqlCommand(
                "SELECT 1 FROM pg_database WHERE datname = @dbName;",
                connection)
            {
                CommandTimeout = 10
            };

            existsCommand.Parameters.AddWithValue("dbName", databaseName);

            var exists = await existsCommand.ExecuteScalarAsync().ConfigureAwait(false) is not null;
            if (exists)
            {
                return;
            }

            await using var createCommand = new NpgsqlCommand(
                $"CREATE DATABASE \"{databaseName}\";",
                connection)
            {
                CommandTimeout = 10
            };

            await createCommand.ExecuteNonQueryAsync().ConfigureAwait(false);
            Console.WriteLine($"[FIXTURE] ✓ Created database: {databaseName}");
        }
        catch (NpgsqlException ex)
        {
            throw new InvalidOperationException(
                $"Failed to ensure database {databaseName} exists: {ex.Message}",
                ex);
        }
    }

    private async Task TruncateSchemasAsync(string databaseName, IReadOnlyList<string> schemas, CancellationToken cancellationToken)
    {
        var connectionString = BuildPostgresConnectionString(databaseName);

        await using var connection = new NpgsqlConnection(connectionString);

        try
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException ex)
        {
            throw new InvalidOperationException($"Failed to open connection to {databaseName}: operation canceled", ex);
        }
        catch (NpgsqlException ex)
        {
            throw new InvalidOperationException($"Failed to open connection to {databaseName}: {ex.Message}", ex);
        }

        try
        {
            await using var listTablesCommand = new NpgsqlCommand(
                """
                SELECT format('%I.%I', schemaname, tablename)
                FROM pg_tables
                WHERE schemaname = ANY(@schemas)
                ORDER BY schemaname, tablename;
                """,
                connection)
            {
                CommandTimeout = 10
            };

            listTablesCommand.Parameters.AddWithValue("schemas", schemas.ToArray());

            var tableNames = new List<string>();
            await using (var reader = await listTablesCommand.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false))
            {
                while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
                {
                    tableNames.Add(reader.GetString(0));
                }
            }

            if (tableNames.Count == 0)
            {
                return;
            }

            var truncateSql = $"TRUNCATE TABLE {string.Join(", ", tableNames)} RESTART IDENTITY CASCADE;";
            await using var truncateCommand = new NpgsqlCommand(truncateSql, connection)
            {
                CommandTimeout = 10
            };

            await truncateCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException ex)
        {
            throw new InvalidOperationException($"Schema truncation for {databaseName} was canceled", ex);
        }
        catch (NpgsqlException ex) when (ex.SqlState == "40P01") // Deadlock
        {
            throw new InvalidOperationException(
                $"Deadlock detected while truncating {databaseName}. " +
                "This may indicate concurrent access. Ensure tests are not running in parallel.",
                ex);
        }
        catch (NpgsqlException ex)
        {
            throw new InvalidOperationException(
                $"Database error while truncating {databaseName} schemas: {ex.Message}",
                ex);
        }
    }

    private async Task FlushRedisAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(10)); // 10-second timeout for Redis flush

            await _redisContainer.ExecAsync(["redis-cli", "FLUSHALL"], cts.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException ex)
        {
            throw new InvalidOperationException(
                "Redis FLUSHALL operation timed out after 10 seconds. " +
                "Redis container may be unhealthy or under heavy load.",
                ex);
        }
    }

    private static async Task WaitForHealthAsync(HttpClient client, string serviceName, CancellationToken cancellationToken)
    {
        var timeout = TimeSpan.FromSeconds(30);
        var startedAt = DateTimeOffset.UtcNow;
        var attempt = 0;

        while (DateTimeOffset.UtcNow - startedAt < timeout)
        {
            attempt++;
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                cts.CancelAfter(TimeSpan.FromSeconds(5)); // Per-request timeout

                var response = await client.GetAsync("/health", HttpCompletionOption.ResponseHeadersRead, cts.Token).ConfigureAwait(false);
                if (response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"[FIXTURE.Health] ✓ {serviceName} ready (attempt {attempt}, {(int)(DateTimeOffset.UtcNow - startedAt).TotalMilliseconds}ms)");
                    return;
                }

                Console.WriteLine($"[FIXTURE.Health] ⚠ {serviceName} returned {response.StatusCode} (attempt {attempt})");
            }
            catch (OperationCanceledException)
            {
                Console.WriteLine($"[FIXTURE.Health] ⏱ {serviceName} request timeout 5s (attempt {attempt})");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[FIXTURE.Health] ⚠ {serviceName} error: {ex.GetType().Name}: {ex.Message} (attempt {attempt})");
            }

            await Task.Delay(TimeSpan.FromMilliseconds(500), cancellationToken).ConfigureAwait(false);
        }

        throw new TimeoutException(
            $"Timed out waiting for {serviceName} health endpoint after {timeout.TotalSeconds}s. " +
            $"Make sure the service is booting correctly and health endpoint is accessible.");
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
            Database = database,
            Timeout = PostgresConnectionTimeoutSeconds,
            CommandTimeout = SqlCommandTimeoutSeconds
        };

        return builder.ConnectionString;
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