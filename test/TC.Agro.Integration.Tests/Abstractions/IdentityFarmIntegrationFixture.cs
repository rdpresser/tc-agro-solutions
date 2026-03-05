using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;
using Testcontainers.PostgreSql;
using Testcontainers.RabbitMq;
using Testcontainers.Redis;
using FarmProgram = TC.Agro.Farm.Service.Program;
using IdentityProgram = TC.Agro.Identity.Service.Program;

namespace TC.Agro.Integration.Tests.Abstractions;

public sealed class IdentityFarmIntegrationFixture : IAsyncLifetime
{
    private const string IdentityDatabase = "tc-agro-identity-db";
    private const string FarmDatabase = "tc-agro-farm-db";
    private const string PostgresUserName = "postgres";
    private const string PostgresPassword = "postgres";

    private readonly PostgreSqlContainer _postgresContainer = new PostgreSqlBuilder("postgres:17-alpine")
        .WithName("tc-agro-integration-tests-postgres")
        .WithDatabase("postgres")
        .WithUsername(PostgresUserName)
        .WithPassword(PostgresPassword)
        .WithPortBinding(5432, true)
        .Build();

    private readonly RabbitMqContainer _rabbitMqContainer = new RabbitMqBuilder("rabbitmq:4.2.3-management-alpine")
        .WithName("tc-agro-integration-tests-rabbitmq")
        .WithUsername("guest")
        .WithPassword("guest")
        .WithPortBinding(5672, true)
        .WithPortBinding(15672, true)
        .Build();

    private readonly RedisContainer _redisContainer = new RedisBuilder("redis:8.4.0-alpine")
        .WithName("tc-agro-integration-tests-redis")
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
        "Telemetry__Grafana__Agent__Enabled"
    ];

    public WebApplicationFactory<IdentityProgram> IdentityFactory { get; private set; } = default!;
    public WebApplicationFactory<FarmProgram> FarmFactory { get; private set; } = default!;

    public HttpClient IdentityClient { get; private set; } = default!;
    public HttpClient FarmClient { get; private set; } = default!;

    public async ValueTask InitializeAsync()
    {
        await _postgresContainer.StartAsync().ConfigureAwait(false);
        await _rabbitMqContainer.StartAsync().ConfigureAwait(false);
        await _redisContainer.StartAsync().ConfigureAwait(false);

        await EnsureDatabaseExistsAsync(IdentityDatabase).ConfigureAwait(false);
        await EnsureDatabaseExistsAsync(FarmDatabase).ConfigureAwait(false);

        ConfigureEnvironment();

        FarmFactory = new WebApplicationFactory<FarmProgram>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"));

        IdentityFactory = new WebApplicationFactory<IdentityProgram>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"));

        FarmClient = FarmFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        IdentityClient = IdentityFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        await WaitForHealthAsync(IdentityClient, "identity").ConfigureAwait(false);
        await WaitForHealthAsync(FarmClient, "farm").ConfigureAwait(false);
    }

    public async ValueTask DisposeAsync()
    {
        IdentityClient?.Dispose();
        FarmClient?.Dispose();
        if (IdentityFactory is not null)
        {
            await IdentityFactory.DisposeAsync().ConfigureAwait(false);
        }
        if (FarmFactory is not null)
        {
            await FarmFactory.DisposeAsync().ConfigureAwait(false);
        }

        foreach (var variableName in _managedEnvironmentVariables)
        {
            Environment.SetEnvironmentVariable(variableName, null);
        }

        await _redisContainer.DisposeAsync().ConfigureAwait(false);
        await _rabbitMqContainer.DisposeAsync().ConfigureAwait(false);
        await _postgresContainer.DisposeAsync().ConfigureAwait(false);
    }

    public async Task<OwnerSnapshotRow?> WaitForOwnerSnapshotAsync(Guid ownerId, TimeSpan timeout, CancellationToken cancellationToken = default)
    {
        var deadline = DateTimeOffset.UtcNow + timeout;

        while (DateTimeOffset.UtcNow < deadline)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var row = await TryGetOwnerSnapshotAsync(ownerId, cancellationToken).ConfigureAwait(false);
            if (row is not null)
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

    private async Task WaitForHealthAsync(HttpClient client, string serviceName)
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

    private async Task<OwnerSnapshotRow?> TryGetOwnerSnapshotAsync(Guid ownerId, CancellationToken cancellationToken)
    {
        var farmConnectionString = BuildPostgresConnectionString(FarmDatabase);

        await using var connection = new NpgsqlConnection(farmConnectionString);
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
}