using System.Globalization;
using Microsoft.Extensions.Configuration;
using TC.Agro.SharedKernel.Infrastructure.Caching.Provider;
using TC.Agro.SharedKernel.Infrastructure.Database;
using TC.Agro.SharedKernel.Infrastructure.MessageBroker;

namespace TC.Agro.AppHost.Aspire.Configuration;

public static class ExternalResourceOptionsResolver
{
    public static RedisOptions ResolveRedisOptions(IConfiguration configuration, RedisOptions sectionOptions)
    {
        var resolved = Clone(sectionOptions);
        var connectionString = configuration.GetConnectionString("redis");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return resolved;
        }

        var parts = connectionString
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (parts.Length == 0)
        {
            return resolved;
        }

        var endpoint = parts[0];
        ParseHostAndPort(endpoint, out var host, out var port);

        if (!string.IsNullOrWhiteSpace(host))
        {
            resolved.Host = host;
        }

        if (port.HasValue)
        {
            resolved.Port = port.Value;
        }

        foreach (var part in parts.Skip(1))
        {
            var separator = part.IndexOf('=');
            if (separator <= 0 || separator >= part.Length - 1)
            {
                continue;
            }

            var key = part[..separator].Trim();
            var value = part[(separator + 1)..].Trim();

            if (key.Equals("password", StringComparison.OrdinalIgnoreCase))
            {
                resolved.Password = value;
                continue;
            }

            if (key.Equals("ssl", StringComparison.OrdinalIgnoreCase) && bool.TryParse(value, out var secure))
            {
                resolved.Secure = secure;
            }
        }

        return resolved;
    }

    public static RabbitMqOptions ResolveRabbitMqOptions(IConfiguration configuration, RabbitMqOptions sectionOptions)
    {
        var resolved = Clone(sectionOptions);
        var connectionString = configuration.GetConnectionString("rabbitmq");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return resolved;
        }

        if (!Uri.TryCreate(connectionString, UriKind.Absolute, out var uri))
        {
            return resolved;
        }

        if (!string.IsNullOrWhiteSpace(uri.Host))
        {
            resolved.Host = uri.Host;
        }

        if (!uri.IsDefaultPort)
        {
            resolved.Port = uri.Port;
        }

        if (!string.IsNullOrWhiteSpace(uri.UserInfo))
        {
            var userInfoParts = uri.UserInfo.Split(':', 2);
            if (userInfoParts.Length > 0 && !string.IsNullOrWhiteSpace(userInfoParts[0]))
            {
                resolved.UserName = Uri.UnescapeDataString(userInfoParts[0]);
            }

            if (userInfoParts.Length > 1)
            {
                resolved.Password = Uri.UnescapeDataString(userInfoParts[1]);
            }
        }

        var virtualHost = Uri.UnescapeDataString(uri.AbsolutePath.Trim('/'));
        resolved.VirtualHost = string.IsNullOrWhiteSpace(virtualHost) ? "/" : virtualHost;

        return resolved;
    }

    public static PostgresOptions ResolvePostgresOptions(IConfiguration configuration, PostgresOptions sectionOptions)
    {
        var resolved = Clone(sectionOptions);
        var connectionString = configuration.GetConnectionString("postgres");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return resolved;
        }

        foreach (var segment in connectionString.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var separator = segment.IndexOf('=');
            if (separator <= 0 || separator >= segment.Length - 1)
            {
                continue;
            }

            var key = segment[..separator].Trim();
            var value = segment[(separator + 1)..].Trim();

            if (IsAnyKey(key, "Host", "Server"))
            {
                resolved.Host = value;
                continue;
            }

            if (IsAnyKey(key, "Port") && int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var port))
            {
                resolved.Port = port;
                continue;
            }

            if (IsAnyKey(key, "Database", "Db"))
            {
                resolved.Database = value;
                continue;
            }

            if (IsAnyKey(key, "Username", "User ID", "UserId", "User"))
            {
                resolved.UserName = value;
                continue;
            }

            if (IsAnyKey(key, "Password", "Pwd"))
            {
                resolved.Password = value;
                continue;
            }

            if (IsAnyKey(key, "SearchPath", "Search Path"))
            {
                resolved.Schema = value;
                continue;
            }

            if (IsAnyKey(key, "SSL Mode", "SslMode"))
            {
                resolved.SslMode = value;
                continue;
            }

            if (IsAnyKey(key, "Trust Server Certificate") && bool.TryParse(value, out var trustServerCertificate))
            {
                resolved.TrustServerCertificate = trustServerCertificate;
            }
        }

        return resolved;
    }

    private static bool IsAnyKey(string key, params string[] expected)
        => expected.Any(e => key.Equals(e, StringComparison.OrdinalIgnoreCase));

    private static void ParseHostAndPort(string endpoint, out string host, out int? port)
    {
        host = endpoint;
        port = null;

        var separator = endpoint.LastIndexOf(':');
        if (separator <= 0 || separator == endpoint.Length - 1)
        {
            return;
        }

        var hostCandidate = endpoint[..separator];
        var portCandidate = endpoint[(separator + 1)..];

        if (!int.TryParse(portCandidate, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedPort))
        {
            return;
        }

        host = hostCandidate;
        port = parsedPort;
    }

    private static RedisOptions Clone(RedisOptions options)
    {
        return new RedisOptions
        {
            Host = options.Host,
            Port = options.Port,
            Password = options.Password,
            Secure = options.Secure,
            InstanceName = options.InstanceName
        };
    }

    private static RabbitMqOptions Clone(RabbitMqOptions options)
    {
        return new RabbitMqOptions
        {
            Host = options.Host,
            Port = options.Port,
            ManagementPort = options.ManagementPort,
            VirtualHost = options.VirtualHost,
            UserName = options.UserName,
            Password = options.Password,
            Exchange = options.Exchange,
            AutoProvision = options.AutoProvision,
            Durable = options.Durable,
            UseQuorumQueues = options.UseQuorumQueues,
            AutoPurgeOnStartup = options.AutoPurgeOnStartup
        };
    }

    private static PostgresOptions Clone(PostgresOptions options)
    {
        return new PostgresOptions
        {
            Host = options.Host,
            Port = options.Port,
            Database = options.Database,
            MaintenanceDatabase = options.MaintenanceDatabase,
            UserName = options.UserName,
            Password = options.Password,
            Schema = options.Schema,
            ConnectionTimeout = options.ConnectionTimeout,
            MinPoolSize = options.MinPoolSize,
            MaxPoolSize = options.MaxPoolSize,
            SslMode = options.SslMode,
            TrustServerCertificate = options.TrustServerCertificate
        };
    }
}
