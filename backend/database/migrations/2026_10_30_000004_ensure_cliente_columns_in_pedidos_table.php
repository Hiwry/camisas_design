<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            if (!Schema::hasColumn('pedidos', 'cliente_nome')) {
                $table->string('cliente_nome', 255)->nullable()->after('prazo');
            }
            if (!Schema::hasColumn('pedidos', 'cliente_email')) {
                $table->string('cliente_email', 255)->nullable()->after('cliente_nome');
            }
            if (!Schema::hasColumn('pedidos', 'cliente_whatsapp')) {
                $table->string('cliente_whatsapp', 255)->nullable()->after('cliente_email');
            }
            if (!Schema::hasColumn('pedidos', 'nome_cliente')) {
                $table->string('nome_cliente', 255)->nullable()->after('cliente_whatsapp');
            }
            if (!Schema::hasColumn('pedidos', 'email_cliente')) {
                $table->string('email_cliente', 255)->nullable()->after('nome_cliente');
            }
            if (!Schema::hasColumn('pedidos', 'whatsapp_cliente')) {
                $table->string('whatsapp_cliente', 255)->nullable()->after('email_cliente');
            }
        });

        // Sincroniza dados existentes caso uma coluna estivesse preenchida e a outra nula
        try {
            DB::statement("UPDATE pedidos SET cliente_nome = COALESCE(cliente_nome, nome_cliente), nome_cliente = COALESCE(nome_cliente, cliente_nome)");
            DB::statement("UPDATE pedidos SET cliente_email = COALESCE(cliente_email, email_cliente), email_cliente = COALESCE(email_cliente, cliente_email)");
            DB::statement("UPDATE pedidos SET cliente_whatsapp = COALESCE(cliente_whatsapp, whatsapp_cliente), whatsapp_cliente = COALESCE(whatsapp_cliente, cliente_whatsapp)");
        } catch (\Throwable $e) {
            // Ignora se não houver dados
        }
    }

    public function down(): void
    {
        // Mantém compatibilidade sem dropar dados
    }
};

