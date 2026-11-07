using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UniFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProductStock : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "StockQuantity",
                table: "products",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddCheckConstraint(
                name: "CK_products_stock_nonnegative",
                table: "products",
                sql: "\"StockQuantity\" >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_products_stock_nonnegative",
                table: "products");

            migrationBuilder.DropColumn(
                name: "StockQuantity",
                table: "products");
        }
    }
}
