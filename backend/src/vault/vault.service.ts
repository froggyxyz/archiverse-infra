import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import vault from 'node-vault'

const VAULT_CIPHER_PREFIX = 'vault:v1:'

/** Имена ключей Transit для разных доменов. В Vault создать: vault write transit/keys/<value> */
export const VAULT_TRANSIT_KEYS = {
  CHAT_MESSAGES: 'chat-messages',
} as const

export type VaultTransitKeyName = (typeof VAULT_TRANSIT_KEYS)[keyof typeof VAULT_TRANSIT_KEYS]

@Injectable()
export class VaultService {
  private readonly client: ReturnType<typeof vault> | null = null
  private readonly defaultKey: string
  private readonly enabled: boolean

  constructor(private readonly config: ConfigService) {
    const addr = this.config.get<string>('VAULT_ADDR')
    const token = this.config.get<string>('VAULT_TOKEN')
    this.defaultKey = this.config.get<string>('VAULT_TRANSIT_KEY', VAULT_TRANSIT_KEYS.CHAT_MESSAGES)
    this.enabled = Boolean(addr && token)

    if (this.enabled) {
      this.client = vault({
        endpoint: addr,
        token,
      })
    }
  }

  isEncryptionEnabled(): boolean {
    return this.enabled
  }

  /**
   * Шифрует строку через Vault Transit. Если Vault не настроен — возвращает plaintext.
   * @param key — имя ключа Transit (из VAULT_TRANSIT_KEYS или свой); без указания — default из конфига.
   */
  async encrypt(plaintext: string, key?: string): Promise<string> {
    if (!this.enabled || !this.client || !plaintext) {
      return plaintext
    }
    const keyName = key ?? this.defaultKey
    const base64 = Buffer.from(plaintext, 'utf8').toString('base64')
    const path = `transit/encrypt/${keyName}`
    const res = await this.client.write(path, { plaintext: base64 })
    const ciphertext = (res as { data?: { ciphertext?: string } }).data?.ciphertext
    if (!ciphertext) {
      throw new Error('Vault encrypt returned no ciphertext')
    }
    return ciphertext
  }

  /**
   * Расшифровывает строку. Если значение не в формате vault:v1:... или Vault выключен — возвращает как есть.
   * @param key — имя ключа Transit, которым было зашифровано (должен совпадать с encrypt).
   */
  async decrypt(ciphertext: string | null, key?: string): Promise<string | null> {
    if (ciphertext == null || ciphertext === '') {
      return ciphertext
    }
    if (!ciphertext.startsWith(VAULT_CIPHER_PREFIX)) {
      return ciphertext
    }
    if (!this.enabled || !this.client) {
      return ciphertext
    }
    const keyName = key ?? this.defaultKey
    const path = `transit/decrypt/${keyName}`
    const res = await this.client.write(path, { ciphertext })
    const base64 = (res as { data?: { plaintext?: string } }).data?.plaintext
    if (!base64) {
      throw new Error('Vault decrypt returned no plaintext')
    }
    return Buffer.from(base64, 'base64').toString('utf8')
  }
}
