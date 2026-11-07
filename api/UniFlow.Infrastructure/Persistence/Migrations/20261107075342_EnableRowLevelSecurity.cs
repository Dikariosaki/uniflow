using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UniFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EnableRowLevelSecurity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE public.pickup_slots ENABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE public.business_settings DISABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE public.opening_hours DISABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE public.order_events DISABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE public.pickup_slots DISABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql("ALTER TABLE public.staff_roles DISABLE ROW LEVEL SECURITY;");
        }
    }
}
