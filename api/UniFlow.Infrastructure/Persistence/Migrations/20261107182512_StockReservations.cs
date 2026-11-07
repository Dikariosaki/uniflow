using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UniFlow.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class StockReservations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "stock_reservations",
                columns: table => new
                {
                    CartToken = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_reservations", x => new { x.CartToken, x.ProductId });
                    table.CheckConstraint("CK_stock_reservations_quantity_positive", "\"Quantity\" > 0");
                    table.ForeignKey(
                        name: "FK_stock_reservations_products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_stock_reservations_ExpiresAt",
                table: "stock_reservations",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_stock_reservations_ProductId",
                table: "stock_reservations",
                column: "ProductId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "stock_reservations");
        }
    }
}
