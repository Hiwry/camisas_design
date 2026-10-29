<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'whatsapp',
        'ativo',
        'creditos_ia',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'ativo' => 'boolean',
        'creditos_ia' => 'integer',
    ];

    // Relacionamentos
    public function confeccao()
    {
        return $this->hasOne(Confeccao::class);
    }

    // Helpers de role
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isConfeccao(): bool
    {
        return $this->role === 'confeccao';
    }
}
