<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SaaS tenant purge/destroy 감사 로그.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('moabom_saas_tenant_operations')) {
            return;
        }

        Schema::create('moabom_saas_tenant_operations', function (Blueprint $table): void {
            $table->id();
            $table->string('slug', 63);
            $table->string('mode', 32)->comment('db_data|storage_data|full_destroy');
            $table->string('status', 32)->default('running')->comment('running|completed|failed');
            $table->unsignedBigInteger('actor_user_id')->nullable();
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('finished_at')->nullable();
            $table->json('metrics_json')->nullable();
            $table->text('error')->nullable();
            $table->timestamps();

            $table->index(['slug', 'status']);
            $table->index('started_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moabom_saas_tenant_operations');
    }
};
