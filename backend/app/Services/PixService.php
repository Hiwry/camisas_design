<?php

namespace App\Services;

class PixService
{
    private string $chave;
    private string $beneficiario;
    private string $cidade;

    public function __construct(?string $chave = null, ?string $beneficiario = null, ?string $cidade = null)
    {
        $this->chave        = $chave ?: config('services.pix.chave', 'financeiro@camisasdesign.com');
        $this->beneficiario = $this->limparTexto($beneficiario ?: config('services.pix.beneficiario', 'Camiseta Design'), 25);
        $this->cidade       = $this->limparTexto($cidade ?: config('services.pix.cidade', 'SAO PAULO'), 15);
    }

    /**
     * Gera o código Pix Copia e Cola (BR Code)
     */
    public function gerarPayload(float $valor, string $txid = '***'): string
    {
        $valorFormatado = number_format($valor, 2, '.', '');

        // 26: Merchant Account Information
        $gui   = $this->tlv('00', 'br.gov.bcb.pix');
        $chave = $this->tlv('01', $this->chave);
        $mai   = $this->tlv('26', $gui . $chave);

        // 62: Additional Data Field (TxID)
        $txidClean = preg_replace('/[^a-zA-Z0-9]/', '', $txid);
        if (empty($txidClean)) $txidClean = '***';
        $txField = $this->tlv('62', $this->tlv('05', substr($txidClean, 0, 25)));

        $payload =
            $this->tlv('00', '01') .                     // Payload Format Indicator
            $this->tlv('01', '12') .                     // Point of Initiation (12 = dinâmico / recorrente)
            $mai .                                       // Informações da conta Pix
            $this->tlv('52', '0000') .                   // Merchant Category Code
            $this->tlv('53', '986') .                    // Moeda (986 = BRL)
            $this->tlv('54', $valorFormatado) .          // Valor da transação
            $this->tlv('58', 'BR') .                     // País
            $this->tlv('59', $this->beneficiario) .      // Nome do recebedor
            $this->tlv('60', $this->cidade) .            // Cidade
            $txField .                                   // TxId
            '6304';                                      // Início do CRC16

        $crc = $this->calcularCRC16($payload);
        return $payload . $crc;
    }

    /**
     * Retorna a URL pública para gerar a imagem do QR Code
     */
    public function gerarQrCodeUrl(string $payload): string
    {
        return 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=' . urlencode($payload);
    }

    /**
     * Formata um campo no padrão TLV (Tag, Length, Value)
     */
    private function tlv(string $tag, string $value): string
    {
        $len = str_pad((string) strlen($value), 2, '0', STR_PAD_LEFT);
        return $tag . $len . $value;
    }

    /**
     * Remove acentos e caracteres especiais para compatibilidade com o padrão EMV
     */
    private function limparTexto(string $texto, int $limite): string
    {
        $clean = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $texto);
        $clean = preg_replace('/[^A-Za-z0-9 ]/', '', $clean);
        return strtoupper(substr(trim($clean), 0, $limite));
    }

    /**
     * Calcula o CRC16-CCITT (0x1021) do payload
     */
    private function calcularCRC16(string $payload): string
    {
        $resultado = 0xFFFF;
        $tamanho = strlen($payload);

        for ($i = 0; $i < $tamanho; $i++) {
            $resultado ^= (ord($payload[$i]) << 8);
            for ($j = 0; $j < 8; $j++) {
                if (($resultado & 0x8000) !== 0) {
                    $resultado = (($resultado << 1) ^ 0x1021) & 0xFFFF;
                } else {
                    $resultado = ($resultado << 1) & 0xFFFF;
                }
            }
        }

        return strtoupper(str_pad(dechex($resultado), 4, '0', STR_PAD_LEFT));
    }
}
