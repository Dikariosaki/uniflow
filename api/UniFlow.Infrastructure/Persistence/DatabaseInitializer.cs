using Microsoft.EntityFrameworkCore;
using UniFlow.Domain.Entities;
using UniFlow.Infrastructure.Supabase;

namespace UniFlow.Infrastructure.Persistence;

public sealed class DatabaseInitializer(UniFlowDbContext db, SupabaseStorage storage)
{
    public async Task InitializeAsync(bool migrate, bool seedDemoData, bool ensureBucket, CancellationToken ct = default)
    {
        if (migrate || seedDemoData) await db.Database.MigrateAsync(ct);
        if (seedDemoData) await SeedDemoData(db);
        if (ensureBucket) await storage.EnsureBucketAsync(ct);
    }
    static async Task SeedDemoData(UniFlowDbContext db)
    {
        if (await db.Categories.AnyAsync()) return;
        var food = new Category { Name = "Comidas", DisplayOrder = 1 };
        var drinks = new Category { Name = "Bebidas", DisplayOrder = 2 };
        db.Categories.AddRange(food, drinks);
        db.Products.AddRange(
            new Product { Category = food, Name = "Arepa Mixta", Description = "Arepa dorada con queso y relleno mixto.", PriceCop = 9500 },
            new Product { Category = food, Name = "Sándwich de Pollo", Description = "Pollo, vegetales frescos y salsa de la casa.", PriceCop = 12000 },
            new Product { Category = drinks, Name = "Café Campesino", Description = "Café colombiano recién preparado.", PriceCop = 4500 },
            new Product { Category = drinks, Name = "Jugo Natural", Description = "Preparado al momento.", PriceCop = 6500 });
        db.BusinessSettings.Add(new BusinessSettings { Name = "Cafetería Bloque B", TimeZone = "America/Bogota" });
        for (var weekday = 0; weekday < 7; weekday++) db.OpeningHours.Add(new OpeningHour { Weekday = weekday, OpensAt = new TimeOnly(7, 0), ClosesAt = new TimeOnly(20, 0) });
        var zone = TimeZoneInfo.FindSystemTimeZoneById("America/Bogota");
        var now = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, zone);
        var start = now.AddMinutes(15 - now.Minute % 15).AddSeconds(-now.Second).AddTicks(-now.Ticks % TimeSpan.TicksPerSecond);
        for (var i = 0; i < 48; i++)
        {
            var localStart = start.AddMinutes(i * 15);
            db.PickupSlots.Add(new PickupSlot { StartsAt = TimeZoneInfo.ConvertTimeToUtc(localStart.DateTime, zone), EndsAt = TimeZoneInfo.ConvertTimeToUtc(localStart.AddMinutes(15).DateTime, zone), Capacity = 5 });
        }
        await db.SaveChangesAsync();
    }
}
