using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UniFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProductIntegrity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddCheckConstraint(
                name: "CK_products_price_cop_nonnegative",
                table: "products",
                sql: "\"PriceCop\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_pickup_slots_capacity_nonnegative",
                table: "pickup_slots",
                sql: "\"Capacity\" >= 0 AND \"EndsAt\" > \"StartsAt\"");

            migrationBuilder.CreateIndex(
                name: "IX_order_items_ProductId",
                table: "order_items",
                column: "ProductId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_order_items_quantities_and_amounts",
                table: "order_items",
                sql: "\"Quantity\" > 0 AND \"UnitPriceCop\" >= 0 AND \"SubtotalCop\" >= 0");

            migrationBuilder.AddForeignKey(
                name: "FK_order_items_products_ProductId",
                table: "order_items",
                column: "ProductId",
                principalTable: "products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_order_items_products_ProductId",
                table: "order_items");

            migrationBuilder.DropCheckConstraint(
                name: "CK_products_price_cop_nonnegative",
                table: "products");

            migrationBuilder.DropCheckConstraint(
                name: "CK_pickup_slots_capacity_nonnegative",
                table: "pickup_slots");

            migrationBuilder.DropIndex(
                name: "IX_order_items_ProductId",
                table: "order_items");

            migrationBuilder.DropCheckConstraint(
                name: "CK_order_items_quantities_and_amounts",
                table: "order_items");
        }
    }
}
