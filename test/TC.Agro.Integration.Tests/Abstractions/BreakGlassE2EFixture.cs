using System.Diagnostics;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Npgsql;
using Quartz;
using SharedKernelServiceCollectionExtensions = TC.Agro.SharedKernel.Extensions.ServiceCollectionExtensions;
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
        FixtureLog.WriteLine($"[FIXTURE] ▶ START {operation}");
    }

    public void Done(string operation, string? details = null)
    {
        _watch.Stop();
        var suffix = !string.IsNullOrEmpty(details) ? $" | {details}" : string.Empty;
        FixtureLog.WriteLine($"[FIXTURE] ✓ DONE  {operation} ({_watch.ElapsedMilliseconds}ms){suffix}");
    }

    public void Error(string operation, Exception ex)
    {
        _watch.Stop();
        FixtureLog.WriteLine($"[FIXTURE] ✗ ERROR {operation} ({_watch.ElapsedMilliseconds}ms): {ex.GetType().Name}: {ex.Message}");
    }
}

file static class FixtureLog
{
    public static void WriteLine(string message)
    {
        Console.WriteLine(message);

        if (!ShouldMirrorToDiagnostics(message))
        {
            return;
        }

        try
        {
            TestContext.Current.SendDiagnosticMessage("{0}", message);
        }
        catch
        {
            // Diagnostic sink is best-effort only.
        }
    }

    private static bool ShouldMirrorToDiagnostics(string message)
        => message.Contains("[FIXTURE.Dispose]", StringComparison.Ordinal)
            || message.Contains("[FIXTURE] ✗", StringComparison.Ordinal)
            || message.Contains("[FIXTURE] ⚠", StringComparison.Ordinal)
            || message.Contains("[FIXTURE.Health] ⚠", StringComparison.Ordinal);
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
    private const int SqlCommandTimeoutSeconds = 15;
    private const int ResetMaxTruncateAttempts = 4;
    private const int ResetRedisFlushMaxAttempts = 3;

    private static readonly TimeSpan FixtureInitializationTimeout = TimeSpan.FromMinutes(3);
    private static readonly TimeSpan HostShutdownTimeout = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan InfrastructureStartupTimeout = TimeSpan.FromSeconds(90);
    private static readonly TimeSpan PerDatabaseBootstrapTimeout = TimeSpan.FromSeconds(20);
    private static readonly TimeSpan PerFactoryDisposeTimeout = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan PerContainerDisposeTimeout = TimeSpan.FromSeconds(45);
    private static readonly TimeSpan TeardownDiagnosticsTimeout = TimeSpan.FromSeconds(5);

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

    private static readonly string[] ServiceScopedEnvironmentVariables =
    [
        "Database__Postgres__Database",
        "Messaging__RabbitMQ__Exchange",
        "Auth__Jwt__Audience__0",
        "Auth__Jwt__Audience__1",
        "Auth__Jwt__Audience__2",
        "Auth__Jwt__Audience__3",
        "Auth__Jwt__Audience__4",
        "OpenAI__Enabled",
        "OpenAI__BaseUrl",
        "OpenAI__ApiKey",
        "OpenAI__Model",
        "OpenAI__Temperature",
        "OpenAI__MaxSuggestions",
        "OpenAI__TimeoutSeconds",
        "WeatherProvider__BaseUrl",
        "WeatherProvider__Latitude",
        "WeatherProvider__Longitude",
        "WeatherProvider__MaxCoordinatesPerRequest",
        "Jobs__SensorReadings__Enabled",
        "Jobs__SensorReadings__IntervalSeconds",
        "Alerts__Thresholds__MaxTemperature",
        "Alerts__Thresholds__MinSoilMoisture",
        "Alerts__Thresholds__MinBatteryLevel"
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

    private readonly HashSet<string> _managedEnvironmentVariables = [];
    private readonly Dictionary<string, string?> _originalEnvironmentVariables = new(StringComparer.Ordinal);

    private readonly List<string> _teardownTimeouts = [];

    private enum ServiceEnvironmentProfile
    {
        Identity,
        Farm,
        SensorIngest,
        Analytics
    }

    protected virtual bool EnableSensorReadingsJob => false;

    protected virtual int SensorReadingsJobIntervalSeconds => 30;

    protected virtual bool StrictTeardownTimeouts
        => ReadBooleanEnvironmentVariable("IntegrationTests__StrictTeardownTimeouts", "TC_AGRO_INTEGRATION_STRICT_TEARDOWN_TIMEOUTS");

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

            instrumentation.Start("Initialize: Compose .env Configuration");
            LoadComposeEnvironmentFiles();
            instrumentation.Done("Initialize: Compose .env Configuration");

            instrumentation.Start("Initialize: Base Environment Configuration");
            ConfigureCommonEnvironment();
            instrumentation.Done("Initialize: Base Environment Configuration");

            instrumentation.Start("Initialize: Service Factories + HTTP Clients");
            IdentityFactory = CreateFactoryForService<IdentityProgram>(ServiceEnvironmentProfile.Identity);
            IdentityClient = CreateClient(IdentityFactory);

            FarmFactory = CreateFactoryForService<FarmProgram>(ServiceEnvironmentProfile.Farm);
            FarmClient = CreateClient(FarmFactory);

            SensorIngestFactory = CreateFactoryForService<SensorIngestEntryPoint>(ServiceEnvironmentProfile.SensorIngest);
            SensorIngestClient = CreateClient(SensorIngestFactory);

            AnalyticsFactory = CreateFactoryForService<AnalyticsProgram>(ServiceEnvironmentProfile.Analytics);
            AnalyticsClient = CreateClient(AnalyticsFactory);
            instrumentation.Done("Initialize: Service Factories + HTTP Clients");

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
        _teardownTimeouts.Clear();

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

            await TryDisposeFactoryAsync(AnalyticsFactory, "analytics-service", PerFactoryDisposeTimeout).ConfigureAwait(false);
            await TryDisposeFactoryAsync(SensorIngestFactory, "sensor-ingest-service", PerFactoryDisposeTimeout).ConfigureAwait(false);
            await TryDisposeFactoryAsync(FarmFactory, "farm-service", PerFactoryDisposeTimeout).ConfigureAwait(false);
            await TryDisposeFactoryAsync(IdentityFactory, "identity-service", PerFactoryDisposeTimeout).ConfigureAwait(false);

            instrumentation.Done("Dispose: Web Application Factories");

            // Phase 3: Clear environment variables (quick)
            instrumentation.Start("Dispose: Environment Variables");
            foreach (var variableName in _managedEnvironmentVariables)
            {
                _originalEnvironmentVariables.TryGetValue(variableName, out var originalValue);
                Environment.SetEnvironmentVariable(variableName, originalValue);
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
                RegisterTeardownTimeout(
                    $"Redis container disposal exceeded {PerContainerDisposeTimeout.TotalSeconds}s.");
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
                RegisterTeardownTimeout(
                    $"RabbitMQ container disposal exceeded {PerContainerDisposeTimeout.TotalSeconds}s.");
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
                RegisterTeardownTimeout(
                    $"PostgreSQL container disposal exceeded {PerContainerDisposeTimeout.TotalSeconds}s.");
            }
            instrumentation.Done("Dispose: PostgreSQL Container");

            if (_teardownTimeouts.Count == 0)
            {
                FixtureLog.WriteLine("[FIXTURE] ✓ All cleanup phases completed successfully");
            }
            else
            {
                FixtureLog.WriteLine($"[FIXTURE] ⚠ Cleanup completed with {_teardownTimeouts.Count} teardown timeout warning(s)");
            }

            // During fixture cleanup, only warn about timeouts (advisory locks in PostgreSQL are expected).
            // Strict mode will have already failed tests if timeouts occurred during actual test execution.
            ThrowIfStrictTeardownTimeouts(isFixtureCleanup: true);
        }
        catch (Exception ex)
        {
            FixtureLog.WriteLine($"[FIXTURE] ✗ ERROR during disposal: {ex.GetType().Name}: {ex.Message}");
            throw;
        }
    }

    public async Task ResetStateAsync(CancellationToken cancellationToken = default)
    {
        var instrumentation = new FixtureInstrumentation();
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(60)); // Per-test reset must complete within 60s

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
            instrumentation.Error("ResetState: TIMEOUT - reset exceeded 60 seconds", ex);
            throw new InvalidOperationException(
                "Per-test state reset timed out after 60 seconds. " +
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
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Development");
                builder.ConfigureServices(services =>
                {
                    services.PostConfigure<HostOptions>(options =>
                    {
                        options.ShutdownTimeout = HostShutdownTimeout;
                    });

                    services.PostConfigure<QuartzHostedServiceOptions>(options =>
                    {
                        options.WaitForJobsToComplete = false;
                    });
                });
            });

    private WebApplicationFactory<TEntryPoint> CreateFactoryForService<TEntryPoint>(ServiceEnvironmentProfile profile)
        where TEntryPoint : class
    {
        ClearServiceScopedEnvironmentVariables();
        ConfigureServiceSpecificEnvironment(profile);
        return CreateFactory<TEntryPoint>();
    }

    private void ClearServiceScopedEnvironmentVariables()
    {
        foreach (var variableName in ServiceScopedEnvironmentVariables)
        {
            SetManagedEnvironmentVariable(variableName, null);
        }
    }

    private static HttpClient CreateClient<TEntryPoint>(WebApplicationFactory<TEntryPoint> factory)
        where TEntryPoint : class
        => factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

    private static void LoadComposeEnvironmentFiles()
    {
        var composeEnvironmentDirectory = FindComposeEnvironmentDirectory()
            ?? throw new InvalidOperationException(
                "Could not locate orchestration/apphost-compose directory to load .env for integration tests.");

        SharedKernelServiceCollectionExtensions.LoadEnvironmentFiles(
            environmentName: "Development",
            environmentFilesDirectory: composeEnvironmentDirectory,
            loadEnvironmentSpecificFile: false);
    }

    private static string? FindComposeEnvironmentDirectory()
    {
        var directory = new DirectoryInfo(Directory.GetCurrentDirectory());

        while (directory is not null)
        {
            var composeDirectory = Path.Combine(directory.FullName, "orchestration", "apphost-compose");
            if (Directory.Exists(composeDirectory))
            {
                return composeDirectory;
            }

            directory = directory.Parent;
        }

        return null;
    }

    private async Task TryDisposeFactoryAsync<TEntryPoint>(
        WebApplicationFactory<TEntryPoint>? factory,
        string serviceName,
        TimeSpan timeout)
        where TEntryPoint : class
    {
        if (factory is null)
        {
            return;
        }

        var stopwatch = Stopwatch.StartNew();

        try
        {
            FixtureLog.WriteLine($"[FIXTURE.Dispose] ▶ {serviceName} factory dispose started (timeout {timeout.TotalSeconds}s)");
            await factory.DisposeAsync()
                .AsTask()
                .WaitAsync(timeout)
                .ConfigureAwait(false);
            FixtureLog.WriteLine($"[FIXTURE.Dispose] ✓ {serviceName} factory disposed cleanly ({stopwatch.ElapsedMilliseconds}ms)");
        }
        catch (TimeoutException ex)
        {
            var diagnostics = await CollectServiceTeardownDiagnosticsAsync(serviceName).ConfigureAwait(false);
            RegisterTeardownTimeout(
                $"Factory disposal for {serviceName} exceeded {timeout.TotalSeconds}s after {stopwatch.ElapsedMilliseconds}ms. {diagnostics}");
            FixtureLog.WriteLine($"[FIXTURE.Dispose] ⚠ {serviceName} timeout details: {ex.Message}");
            return;
        }
        catch (PostgresException postgresException) when (postgresException.SqlState is "57P01" or "57P02" or "57P03")
        {
            // Expected: Postgres closes connections during host disposal
            FixtureLog.WriteLine($"[FIXTURE.Dispose] ⚠ {serviceName} - benign Postgres shutdown ({postgresException.SqlState})");
        }
        catch (Exception ex) when (IsBenignTeardownException(ex))
        {
            // Expected: Infrastructure shutdown races
            FixtureLog.WriteLine($"[FIXTURE.Dispose] ⚠ {serviceName} - benign infrastructure exception: {ex.GetType().Name}");
        }
        catch (Exception ex)
        {
            FixtureLog.WriteLine($"[FIXTURE.Dispose] ✗ {serviceName} factory disposal error: {ex.GetType().Name}: {ex.Message}");
            throw;
        }
    }

    private void RegisterTeardownTimeout(string message)
    {
        _teardownTimeouts.Add(message);
        FixtureLog.WriteLine($"[FIXTURE.Dispose] ⚠ {message}");
    }

    /// <summary>
    /// Thrown at END of fixture cleanup if strict teardown mode is enabled and any timeouts were recorded.
    /// During fixture cleanup, advisory locks in database are expected, so timeout messages are logged as warnings only.
    /// During test execution, any timeout is an error that should be investigated.
    /// </summary>
    private void ThrowIfStrictTeardownTimeouts(bool isFixtureCleanup = false)
    {
        if (!StrictTeardownTimeouts || _teardownTimeouts.Count == 0)
        {
            return;
        }

        // During fixture cleanup, only log warnings (advisory locks are expected during PostgreSQL cleanup)
        if (isFixtureCleanup)
        {
            return; // Already logged in DisposeAsync above
        }

        // During test execution, throw if any timeouts detected in strict mode
        throw new InvalidOperationException(
            "Strict teardown mode detected timeout(s) during test execution:" + Environment.NewLine +
            string.Join(Environment.NewLine, _teardownTimeouts.Select(timeout => $" - {timeout}")));
    }

    private static bool ReadBooleanEnvironmentVariable(params string[] variableNames)
    {
        foreach (var variableName in variableNames)
        {
            var value = Environment.GetEnvironmentVariable(variableName);
            if (bool.TryParse(value, out var parsed))
            {
                return parsed;
            }
        }

        return false;
    }

    private async Task<string> CollectServiceTeardownDiagnosticsAsync(string serviceName)
    {
        var process = Process.GetCurrentProcess();
        var processSummary =
            $"HostProcess(pid={process.Id}, threads={process.Threads.Count}, handles={process.HandleCount}, workingSetMiB={Math.Round(process.WorkingSet64 / 1024d / 1024d, 1):0.0})";

        var databaseName = GetDatabaseNameForService(serviceName);
        if (databaseName is null)
        {
            return processSummary;
        }

        try
        {
            using var cts = new CancellationTokenSource(TeardownDiagnosticsTimeout);
            var databaseSnapshot = await GetDatabaseActivitySnapshotAsync(databaseName, cts.Token).ConfigureAwait(false);
            return $"{processSummary}; Database={databaseName}; {databaseSnapshot}";
        }
        catch (Exception ex)
        {
            return $"{processSummary}; Database={databaseName}; diagnostics unavailable: {ex.GetType().Name}: {ex.Message}";
        }
    }

    private static string? GetDatabaseNameForService(string serviceName)
        => serviceName switch
        {
            "identity-service" => IdentityDatabase,
            "farm-service" => FarmDatabase,
            "sensor-ingest-service" => SensorIngestDatabase,
            "analytics-service" => AnalyticsDatabase,
            _ => null
        };

    private async Task<string> GetDatabaseActivitySnapshotAsync(string databaseName, CancellationToken cancellationToken)
    {
        var maintenanceConnectionString = BuildPostgresConnectionString("postgres");

        await using var connection = new NpgsqlConnection(maintenanceConnectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

        await using var countCommand = new NpgsqlCommand(
            "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = @databaseName AND pid <> pg_backend_pid();",
            connection)
        {
            CommandTimeout = 5
        };

        countCommand.Parameters.AddWithValue("databaseName", databaseName);

        var totalSessionsResult = await countCommand.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);
        var totalSessions = totalSessionsResult is long longCount ? (int)longCount : Convert.ToInt32(totalSessionsResult);

        if (totalSessions == 0)
        {
            return "pg_stat_activity reports no remaining sessions";
        }

        await using var detailsCommand = new NpgsqlCommand(
            """
            SELECT
                pid,
                COALESCE(NULLIF(application_name, ''), '<empty>') AS application_name,
                COALESCE(state, '<unknown>') AS state,
                COALESCE(wait_event_type, '-') AS wait_event_type,
                COALESCE(wait_event, '-') AS wait_event,
                COALESCE(backend_type, '-') AS backend_type,
                COALESCE(CAST(EXTRACT(EPOCH FROM (clock_timestamp() - xact_start)) AS integer)::text, '-') AS transaction_age_seconds,
                LEFT(REGEXP_REPLACE(COALESCE(query, '<none>'), '\s+', ' ', 'g'), 160) AS query
            FROM pg_stat_activity
            WHERE datname = @databaseName
              AND pid <> pg_backend_pid()
            ORDER BY
                CASE
                    WHEN state = 'active' THEN 0
                    WHEN state = 'idle in transaction' THEN 1
                    ELSE 2
                END,
                pid
            LIMIT 5;
            """,
            connection)
        {
            CommandTimeout = 5
        };

        detailsCommand.Parameters.AddWithValue("databaseName", databaseName);

        var sessions = new List<string>();

        await using var reader = await detailsCommand.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            sessions.Add(
                $"pid={reader.GetInt32(0)}, app={reader.GetString(1)}, state={reader.GetString(2)}, wait={reader.GetString(3)}/{reader.GetString(4)}, backend={reader.GetString(5)}, txAgeSec={reader.GetString(6)}, query={reader.GetString(7)}");
        }

        return $"pg_stat_activity sessions={totalSessions}; topSessions=[{string.Join(" || ", sessions)}]";
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

    private void ConfigureCommonEnvironment()
    {
        SetManagedEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Development");

        SetManagedEnvironmentVariable("Database__Postgres__Host", _postgresContainer.Hostname);
        SetManagedEnvironmentVariable("Database__Postgres__Port", _postgresContainer.GetMappedPublicPort(5432).ToString());
        SetManagedEnvironmentVariable("Database__Postgres__UserName", PostgresUserName);
        SetManagedEnvironmentVariable("Database__Postgres__Password", PostgresPassword);
        SetManagedEnvironmentVariable("Database__Postgres__Schema", "public");
        SetManagedEnvironmentVariable("Database__Postgres__MaintenanceDatabase", "postgres");
        SetManagedEnvironmentVariable("Database__Postgres__ConnectionTimeout", "30");
        SetManagedEnvironmentVariable("Database__Postgres__MinPoolSize", "2");
        SetManagedEnvironmentVariable("Database__Postgres__MaxPoolSize", "20");

        SetManagedEnvironmentVariable("Cache__Redis__Host", _redisContainer.Hostname);
        SetManagedEnvironmentVariable("Cache__Redis__Port", _redisContainer.GetMappedPublicPort(6379).ToString());
        SetManagedEnvironmentVariable("Cache__Redis__Password", string.Empty);
        SetManagedEnvironmentVariable("Cache__Redis__DefaultTTL", "300");
        SetManagedEnvironmentVariable("Cache__Redis__InstanceName", "tc-agro-integration-tests");

        SetManagedEnvironmentVariable("Messaging__RabbitMQ__Host", _rabbitMqContainer.Hostname);
        SetManagedEnvironmentVariable("Messaging__RabbitMQ__Port", _rabbitMqContainer.GetMappedPublicPort(5672).ToString());
        SetManagedEnvironmentVariable("Messaging__RabbitMQ__ManagementPort", _rabbitMqContainer.GetMappedPublicPort(15672).ToString());
        SetManagedEnvironmentVariable("Messaging__RabbitMQ__VirtualHost", "/");
        SetManagedEnvironmentVariable("Messaging__RabbitMQ__UserName", "guest");
        SetManagedEnvironmentVariable("Messaging__RabbitMQ__Password", "guest");
        SetManagedEnvironmentVariable("Messaging__RabbitMQ__AutoProvision", "true");
        SetManagedEnvironmentVariable("Messaging__RabbitMQ__Durable", "true");
        SetManagedEnvironmentVariable("Messaging__RabbitMQ__AutoPurgeOnStartup", "true");
        SetManagedEnvironmentVariable("Messaging__RabbitMQ__UseQuorumQueues", "false");

        SetManagedEnvironmentVariable("Services__Identity__HttpPort", "5001");
        SetManagedEnvironmentVariable("Services__Farm__HttpPort", "5002");
        SetManagedEnvironmentVariable("Services__SensorIngest__HttpPort", "5003");
        SetManagedEnvironmentVariable("Services__AnalyticsWorker__HttpPort", "5004");
        SetManagedEnvironmentVariable("Services__Dashboard__HttpPort", "5005");

        SetManagedEnvironmentVariable("Auth__Jwt__Issuer", "tc-agro-identity-service");
        SetManagedEnvironmentVariable("Auth__Jwt__SecretKey", "your-256-bit-secret-key-change-in-production-12345678901234567890");
        SetManagedEnvironmentVariable("Auth__Jwt__ExpirationInMinutes", "480");

        SetManagedEnvironmentVariable("Logging__LogLevel__Default", "Information");
        SetManagedEnvironmentVariable("Logging__LogLevel__Microsoft_AspNetCore", "Warning");
        SetManagedEnvironmentVariable("Logging__LogLevel__System", "Warning");

        SetManagedEnvironmentVariable("Telemetry__Grafana__Agent__Host", "localhost");
        SetManagedEnvironmentVariable("Telemetry__Grafana__Agent__OtlpGrpcPort", "4317");
        SetManagedEnvironmentVariable("Telemetry__Grafana__Agent__OtlpHttpPort", "4318");
        SetManagedEnvironmentVariable("Telemetry__Grafana__Agent__MetricsPort", "8889");
        SetManagedEnvironmentVariable("Telemetry__Grafana__Agent__Enabled", "false");
        SetManagedEnvironmentVariable("Telemetry__Grafana__Otlp__Endpoint", "http://localhost:4318");
        SetManagedEnvironmentVariable("Telemetry__Grafana__Otlp__Protocol", "http/protobuf");
        SetManagedEnvironmentVariable("Telemetry__Grafana__Otlp__TimeoutSeconds", "10");
        SetManagedEnvironmentVariable("Telemetry__Grafana__Otlp__Insecure", "true");
    }

    private void ConfigureServiceSpecificEnvironment(ServiceEnvironmentProfile profile)
    {
        switch (profile)
        {
            case ServiceEnvironmentProfile.Identity:
                SetManagedEnvironmentVariable("Database__Postgres__Database", IdentityDatabase);
                SetManagedEnvironmentVariable("Messaging__RabbitMQ__Exchange", "identity.events");
                SetManagedEnvironmentVariable("Auth__Jwt__Audience__0", "tc-agro-identity-service");
                SetManagedEnvironmentVariable("Auth__Jwt__Audience__1", "tc-agro-farm-service");
                SetManagedEnvironmentVariable("Auth__Jwt__Audience__2", "tc-agro-sensor-ingest-service");
                SetManagedEnvironmentVariable("Auth__Jwt__Audience__3", "tc-agro-analytics-worker");
                SetManagedEnvironmentVariable("Auth__Jwt__Audience__4", "tc-agro-dashboard-service");
                break;

            case ServiceEnvironmentProfile.Farm:
                SetManagedEnvironmentVariable("Database__Postgres__Database", FarmDatabase);
                SetManagedEnvironmentVariable("Messaging__RabbitMQ__Exchange", "farm.events");
                SetManagedEnvironmentVariable("Auth__Jwt__Audience__0", "tc-agro-farm-service");
                SetManagedEnvironmentVariable("OpenAI__Enabled", "true");
                SetManagedEnvironmentVariable("OpenAI__BaseUrl", "https://api.openai.com/");
                SetManagedEnvironmentVariable("OpenAI__ApiKey", ResolveManagedEnvironmentVariable("OpenAI__ApiKey", "test-openai-api-key"));
                SetManagedEnvironmentVariable("OpenAI__Model", "gpt-4o-mini");
                SetManagedEnvironmentVariable("OpenAI__Temperature", "0.3");
                SetManagedEnvironmentVariable("OpenAI__MaxSuggestions", "15");
                SetManagedEnvironmentVariable("OpenAI__TimeoutSeconds", "60");
                break;

            case ServiceEnvironmentProfile.SensorIngest:
                SetManagedEnvironmentVariable("Database__Postgres__Database", SensorIngestDatabase);
                SetManagedEnvironmentVariable("Messaging__RabbitMQ__Exchange", "sensor-ingest.events");
                SetManagedEnvironmentVariable("Auth__Jwt__Audience__0", "tc-agro-sensor-ingest-service");
                SetManagedEnvironmentVariable("WeatherProvider__BaseUrl", "https://api.open-meteo.com");
                SetManagedEnvironmentVariable("WeatherProvider__Latitude", "-22.7256");
                SetManagedEnvironmentVariable("WeatherProvider__Longitude", "-47.6492");
                SetManagedEnvironmentVariable("WeatherProvider__MaxCoordinatesPerRequest", "50");
                SetManagedEnvironmentVariable("Jobs__SensorReadings__Enabled", EnableSensorReadingsJob ? "true" : "false");
                SetManagedEnvironmentVariable("Jobs__SensorReadings__IntervalSeconds", SensorReadingsJobIntervalSeconds.ToString());
                break;

            case ServiceEnvironmentProfile.Analytics:
                SetManagedEnvironmentVariable("Database__Postgres__Database", AnalyticsDatabase);
                SetManagedEnvironmentVariable("Messaging__RabbitMQ__Exchange", "analytics.events");
                SetManagedEnvironmentVariable("Auth__Jwt__Audience__0", "tc-agro-analytics-worker");
                SetManagedEnvironmentVariable("Alerts__Thresholds__MaxTemperature", "35");
                SetManagedEnvironmentVariable("Alerts__Thresholds__MinSoilMoisture", "30");
                SetManagedEnvironmentVariable("Alerts__Thresholds__MinBatteryLevel", "20");
                break;
        }
    }

    private void SetManagedEnvironmentVariable(string variableName, string? value)
    {
        if (!_originalEnvironmentVariables.ContainsKey(variableName))
        {
            _originalEnvironmentVariables[variableName] = Environment.GetEnvironmentVariable(variableName);
        }

        _managedEnvironmentVariables.Add(variableName);
        Environment.SetEnvironmentVariable(variableName, value);
    }

    private string ResolveManagedEnvironmentVariable(string variableName, string fallbackValue)
    {
        var currentValue = Environment.GetEnvironmentVariable(variableName);
        if (!string.IsNullOrWhiteSpace(currentValue))
        {
            return currentValue;
        }

        if (_originalEnvironmentVariables.TryGetValue(variableName, out var originalValue) &&
            !string.IsNullOrWhiteSpace(originalValue))
        {
            return originalValue;
        }

        return fallbackValue;
    }

    private static string ResolveEnvironmentVariable(string variableName, string fallbackValue)
    {
        var value = Environment.GetEnvironmentVariable(variableName);
        return string.IsNullOrWhiteSpace(value) ? fallbackValue : value;
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
            FixtureLog.WriteLine($"[FIXTURE] ✓ Created database: {databaseName}");
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
        for (var attempt = 1; attempt <= ResetMaxTruncateAttempts; attempt++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                await TruncateSchemasCoreAsync(databaseName, schemas, cancellationToken).ConfigureAwait(false);

                if (attempt > 1)
                {
                    FixtureLog.WriteLine($"[FIXTURE.Reset] ✓ Truncate for {databaseName} succeeded on attempt {attempt}/{ResetMaxTruncateAttempts}");
                }

                return;
            }
            catch (NpgsqlException ex) when (IsTransientTruncateFailure(ex) && attempt < ResetMaxTruncateAttempts)
            {
                if (attempt == ResetMaxTruncateAttempts - 1 && RequiresAggressiveRecovery(ex))
                {
                    await TerminateClientSessionsAsync(databaseName, cancellationToken).ConfigureAwait(false);
                }

                NpgsqlConnection.ClearAllPools();

                FixtureLog.WriteLine(
                    $"[FIXTURE.Reset] ⚠ Truncate for {databaseName} failed on attempt {attempt}/{ResetMaxTruncateAttempts}: {ex.Message}. Retrying...");

                await Task.Delay(TimeSpan.FromMilliseconds(250 * attempt), cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException ex)
                when (!cancellationToken.IsCancellationRequested && IsTransientTruncateCancellation(ex) && attempt < ResetMaxTruncateAttempts)
            {
                if (attempt == ResetMaxTruncateAttempts - 1 && RequiresAggressiveRecovery(ex))
                {
                    await TerminateClientSessionsAsync(databaseName, cancellationToken).ConfigureAwait(false);
                }

                NpgsqlConnection.ClearAllPools();

                FixtureLog.WriteLine(
                    $"[FIXTURE.Reset] ⚠ Truncate for {databaseName} was transiently cancelled on attempt {attempt}/{ResetMaxTruncateAttempts}: {ex.Message}. Retrying...");

                await Task.Delay(TimeSpan.FromMilliseconds(250 * attempt), cancellationToken).ConfigureAwait(false);
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
    }

    private async Task TruncateSchemasCoreAsync(string databaseName, IReadOnlyList<string> schemas, CancellationToken cancellationToken)
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

        await using var listTablesCommand = new NpgsqlCommand(
            """
            SELECT format('%I.%I', schemaname, tablename)
            FROM pg_tables
            WHERE schemaname = ANY(@schemas)
            ORDER BY schemaname, tablename;
            """,
            connection)
        {
            CommandTimeout = SqlCommandTimeoutSeconds
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
            CommandTimeout = SqlCommandTimeoutSeconds
        };

        await truncateCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    private static bool IsTransientTruncateFailure(NpgsqlException exception)
    {
        if (exception.SqlState is "40P01" or "55P03" or "57P01")
        {
            return true;
        }

        if (exception.InnerException is TimeoutException)
        {
            return true;
        }

        return exception.InnerException is NpgsqlException nested && IsTransientTruncateFailure(nested);
    }

    private static bool IsTransientTruncateCancellation(OperationCanceledException exception)
    {
        if (exception.InnerException is PostgresException postgresException && postgresException.SqlState == "57014")
        {
            return true;
        }

        return exception.InnerException is OperationCanceledException nested && IsTransientTruncateCancellation(nested);
    }

    private static bool RequiresAggressiveRecovery(NpgsqlException exception)
    {
        if (exception.SqlState is "40P01" or "55P03")
        {
            return true;
        }

        if (exception.InnerException is TimeoutException)
        {
            return true;
        }

        return exception.InnerException is NpgsqlException nested && RequiresAggressiveRecovery(nested);
    }

    private static bool RequiresAggressiveRecovery(OperationCanceledException exception)
        => exception.InnerException is PostgresException postgresException && postgresException.SqlState == "57014";

    private async Task TerminateClientSessionsAsync(string databaseName, CancellationToken cancellationToken)
    {
        try
        {
            var maintenanceConnectionString = BuildPostgresConnectionString("postgres");

            await using var maintenanceConnection = new NpgsqlConnection(maintenanceConnectionString);
            await maintenanceConnection.OpenAsync(cancellationToken).ConfigureAwait(false);

            await using var countCommand = new NpgsqlCommand(
                """
                SELECT COUNT(*)
                FROM pg_stat_activity
                WHERE datname = @databaseName
                  AND pid <> pg_backend_pid()
                  AND backend_type = 'client backend';
                """,
                maintenanceConnection)
            {
                CommandTimeout = SqlCommandTimeoutSeconds
            };

            countCommand.Parameters.AddWithValue("databaseName", databaseName);

            var countResult = await countCommand.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);
            var activeSessions = countResult is long sessionCount ? (int)sessionCount : Convert.ToInt32(countResult);

            if (activeSessions == 0)
            {
                return;
            }

            await using var terminateCommand = new NpgsqlCommand(
                """
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = @databaseName
                  AND pid <> pg_backend_pid()
                  AND backend_type = 'client backend';
                """,
                maintenanceConnection)
            {
                CommandTimeout = SqlCommandTimeoutSeconds
            };

            terminateCommand.Parameters.AddWithValue("databaseName", databaseName);
            await terminateCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);

            FixtureLog.WriteLine(
                $"[FIXTURE.Reset] ⚠ Applied aggressive recovery and terminated {activeSessions} session(s) on {databaseName}");
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            FixtureLog.WriteLine(
                $"[FIXTURE.Reset] ⚠ Aggressive recovery failed for {databaseName}: {ex.GetType().Name}: {ex.Message}");
        }
    }

    private async Task FlushRedisAsync(CancellationToken cancellationToken)
    {
        for (var attempt = 1; attempt <= ResetRedisFlushMaxAttempts; attempt++)
        {
            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                cts.CancelAfter(TimeSpan.FromSeconds(15));

                await _redisContainer.ExecAsync(["redis-cli", "FLUSHALL"], cts.Token).ConfigureAwait(false);
                return;
            }
            catch (OperationCanceledException ex)
                when (!cancellationToken.IsCancellationRequested && attempt < ResetRedisFlushMaxAttempts)
            {
                FixtureLog.WriteLine(
                    $"[FIXTURE.Reset] ⚠ Redis FLUSHALL timed out on attempt {attempt}/{ResetRedisFlushMaxAttempts}: {ex.Message}. Retrying...");
                await Task.Delay(TimeSpan.FromMilliseconds(250 * attempt), cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex) when (attempt < ResetRedisFlushMaxAttempts)
            {
                FixtureLog.WriteLine(
                    $"[FIXTURE.Reset] ⚠ Redis FLUSHALL failed on attempt {attempt}/{ResetRedisFlushMaxAttempts}: {ex.Message}. Retrying...");
                await Task.Delay(TimeSpan.FromMilliseconds(250 * attempt), cancellationToken).ConfigureAwait(false);
            }
        }

        throw new InvalidOperationException(
            $"Redis FLUSHALL operation failed after {ResetRedisFlushMaxAttempts} attempts. " +
            "Redis container may be unhealthy or under heavy load.");
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
                    FixtureLog.WriteLine($"[FIXTURE.Health] ✓ {serviceName} ready (attempt {attempt}, {(int)(DateTimeOffset.UtcNow - startedAt).TotalMilliseconds}ms)");
                    return;
                }

                FixtureLog.WriteLine($"[FIXTURE.Health] ⚠ {serviceName} returned {response.StatusCode} (attempt {attempt})");
            }
            catch (OperationCanceledException)
            {
                FixtureLog.WriteLine($"[FIXTURE.Health] ⏱ {serviceName} request timeout 5s (attempt {attempt})");
            }
            catch (Exception ex)
            {
                FixtureLog.WriteLine($"[FIXTURE.Health] ⚠ {serviceName} error: {ex.GetType().Name}: {ex.Message} (attempt {attempt})");
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