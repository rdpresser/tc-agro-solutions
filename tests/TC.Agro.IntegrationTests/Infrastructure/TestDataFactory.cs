namespace TC.Agro.IntegrationTests.Infrastructure;

/// <summary>
/// Factory for creating test data with realistic values
/// </summary>
public static class TestDataFactory
{
    private static readonly Random Random = new();

    /// <summary>
    /// Generate a unique test email
    /// </summary>
    public static string GenerateTestEmail() => 
        $"test.user.{Guid.NewGuid().ToString("N")[..8]}@agro-test.com";

    /// <summary>
    /// Generate a test password (for test environments only)
    /// </summary>
    public static string GenerateTestPassword() => 
        $"Test@Pass{Random.Next(1000, 9999)}";

    /// <summary>
    /// Generate a unique property name
    /// </summary>
    public static string GeneratePropertyName() => 
        $"Fazenda Test {Guid.NewGuid().ToString("N")[..6]}";

    /// <summary>
    /// Generate a realistic location
    /// </summary>
    public static string GenerateLocation() => 
        $"{GetRandomCity()}, {GetRandomState()}";

    /// <summary>
    /// Generate a unique plot name
    /// </summary>
    public static string GeneratePlotName() => 
        $"Talhão {Random.Next(1, 999):D3}";

    /// <summary>
    /// Get a random crop type
    /// </summary>
    public static string GetRandomCropType() => 
        new[] { "Soja", "Milho", "Café", "Cana-de-açúcar", "Algodão", "Trigo" }[Random.Next(6)];

    private static string GetRandomCity() => 
        new[] { "Campinas", "Ribeirão Preto", "Piracicaba", "São Carlos", "Araraquara" }[Random.Next(5)];

    private static string GetRandomState() => 
        new[] { "SP", "MG", "PR", "GO", "MT", "MS" }[Random.Next(6)];

    /// <summary>
    /// Generate realistic area in hectares
    /// </summary>
    public static double GenerateAreaHectares() => 
        Math.Round(Random.NextDouble() * 500 + 50, 2); // 50-550 hectares

    /// <summary>
    /// Generate a unique sensor ID
    /// </summary>
    public static string GenerateSensorId() => 
        $"SENSOR-{Guid.NewGuid().ToString("N")[..8].ToUpper()}";
}
