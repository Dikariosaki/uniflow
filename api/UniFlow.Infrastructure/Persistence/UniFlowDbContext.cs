using Microsoft.EntityFrameworkCore;

using UniFlow.Domain.Entities;

namespace UniFlow.Infrastructure.Persistence;

public sealed class UniFlowDbContext(DbContextOptions<UniFlowDbContext> options) : DbContext(options)
{
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<StockReservation> StockReservations => Set<StockReservation>();
    public DbSet<BusinessSettings> BusinessSettings => Set<BusinessSettings>();
    public DbSet<OpeningHour> OpeningHours => Set<OpeningHour>();
    public DbSet<PickupSlot> PickupSlots => Set<PickupSlot>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderEvent> OrderEvents => Set<OrderEvent>();
    public DbSet<StaffRole> StaffRoles => Set<StaffRole>();
    public DbSet<AdminAuditEvent> AdminAuditEvents => Set<AdminAuditEvent>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<Category>().ToTable("categories").HasKey(x => x.Id);
        model.Entity<Category>().Property(x => x.Name).HasMaxLength(100).IsRequired();
        model.Entity<Product>().ToTable("products", table =>
        {
            table.HasCheckConstraint("CK_products_price_cop_nonnegative", "\"PriceCop\" >= 0");
            table.HasCheckConstraint("CK_products_stock_nonnegative", "\"StockQuantity\" >= 0");
        }).HasKey(x => x.Id);
        model.Entity<Product>().Property(x => x.Name).HasMaxLength(160).IsRequired();
        model.Entity<Product>().Property(x => x.Description).HasMaxLength(1000);
        model.Entity<Product>().HasOne(x => x.Category).WithMany(x => x.Products).HasForeignKey(x => x.CategoryId);
        model.Entity<StockReservation>().ToTable("stock_reservations", table =>
        {
            table.HasCheckConstraint("CK_stock_reservations_quantity_positive", "\"Quantity\" > 0");
        }).HasKey(x => new { x.CartToken, x.ProductId });
        model.Entity<StockReservation>().Property(x => x.CartToken).HasMaxLength(64);
        model.Entity<StockReservation>().HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        model.Entity<StockReservation>().HasIndex(x => x.ExpiresAt);
        model.Entity<BusinessSettings>().ToTable("business_settings").HasKey(x => x.Id);
        model.Entity<OpeningHour>().ToTable("opening_hours").HasKey(x => x.Id);
        model.Entity<PickupSlot>().ToTable("pickup_slots", table => table.HasCheckConstraint("CK_pickup_slots_capacity_nonnegative", "\"Capacity\" >= 0 AND \"EndsAt\" > \"StartsAt\"")).HasKey(x => x.Id);
        model.Entity<PickupSlot>().HasIndex(x => new { x.StartsAt, x.Active });
        model.Entity<Order>().ToTable("orders").HasKey(x => x.Id);
        model.Entity<Order>().HasIndex(x => new { x.IdempotencyKey }).IsUnique();
        model.Entity<Order>().HasIndex(x => x.TrackingTokenHash).IsUnique();
        model.Entity<Order>().HasIndex(x => new { x.SlotId, x.Status });
        model.Entity<Order>().Property(x => x.PickupCode).HasMaxLength(12);
        model.Entity<Order>().Property(x => x.TrackingTokenHash).HasMaxLength(64);
        model.Entity<Order>().Property(x => x.IdempotencyKey).HasMaxLength(128);
        model.Entity<Order>().Property(x => x.CustomerAlias).HasMaxLength(80);
        model.Entity<Order>().Property(x => x.CustomerPhone).HasMaxLength(32);
        model.Entity<Order>().HasOne(x => x.Slot).WithMany().HasForeignKey(x => x.SlotId);
        model.Entity<OrderItem>().ToTable("order_items", table => table.HasCheckConstraint("CK_order_items_quantities_and_amounts", "\"Quantity\" > 0 AND \"UnitPriceCop\" >= 0 AND \"SubtotalCop\" >= 0")).HasKey(x => x.Id);
        model.Entity<OrderItem>().Property(x => x.NameSnapshot).HasMaxLength(160);
        model.Entity<Order>().HasMany(x => x.Items).WithOne().HasForeignKey(x => x.OrderId);
        model.Entity<OrderItem>().HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<OrderEvent>().ToTable("order_events").HasKey(x => x.Id);
        model.Entity<OrderEvent>().Property(x => x.NewStatus).HasMaxLength(32);
        model.Entity<OrderEvent>().HasIndex(x => new { x.OrderId, x.CreatedAt });
        model.Entity<StaffRole>().ToTable("staff_roles").HasKey(x => x.UserId);
        model.Entity<StaffRole>().Property(x => x.UserId).HasMaxLength(64);
        model.Entity<StaffRole>().Property(x => x.Role).HasMaxLength(32);
        model.Entity<AdminAuditEvent>().ToTable("admin_audit_events").HasKey(x => x.Id);
        model.Entity<AdminAuditEvent>().Property(x => x.ActorId).HasMaxLength(64);
        model.Entity<AdminAuditEvent>().Property(x => x.Action).HasMaxLength(80);
        model.Entity<AdminAuditEvent>().Property(x => x.EntityType).HasMaxLength(80);
        model.Entity<AdminAuditEvent>().Property(x => x.EntityId).HasMaxLength(80);
        model.Entity<AdminAuditEvent>().Property(x => x.Details).HasMaxLength(1000);
        model.Entity<AdminAuditEvent>().HasIndex(x => x.CreatedAt);
    }
}
