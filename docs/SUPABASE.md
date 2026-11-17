# Configurar o Supabase (Fase 4)

Sem esta configuração o app funciona **100% no aparelho**, como antes. Com ela, o usuário
pode entrar com um código de e-mail, sincronizar entre aparelhos e participar da liga
com outras pessoas.

## 1. Criar o projeto
1. Crie uma conta em <https://supabase.com> e um projeto novo (região São Paulo, se disponível).
2. Guarde a senha do banco num lugar seguro (ela não vai para o app).

## 2. Criar as tabelas e regras de segurança
Escolha **uma** das opções:

- **Pelo painel:** *SQL Editor* → *New query* → cole o conteúdo de
  `supabase/migrations/20261117000000_invest_level_init.sql` → *Run*.
- **Pela CLI:** `npx supabase login`, `npx supabase link --project-ref SEU_REF` e
  `npx supabase db push`.

Confira em *Table Editor* que existem `game_states`, `league_groups` e `league_members`, todas
com **RLS enabled**.

## 3. Login por código de e-mail
1. *Authentication* → *Providers* → *Email*: deixe **Enable Email provider** ligado.
   Confirme que **Email OTP Length** está em **6**.
2. *Authentication* → *Email Templates*: nos modelos **Magic Link** e **Confirm signup**,
   troque o corpo para mostrar o código, por exemplo:

   ```html
   <h2>Seu código do Invest Level</h2>
   <p>Digite este código no app: <strong>{{ .Token }}</strong></p>
   <p>Se não foi você, ignore este e-mail.</p>
   ```
3. **Produção:** o envio de e-mails padrão do Supabase tem limite baixo por hora. Configure um
   SMTP próprio em *Project Settings* → *Authentication* → *SMTP Settings*.

## 4. Exclusão de conta (Edge Function)
```bash
npx supabase functions deploy delete-account
```
A função usa `SUPABASE_SERVICE_ROLE_KEY`, que o Supabase já injeta no servidor.
**Nunca** coloque a service_role key no app.

## 5. Ligar o app ao projeto
1. *Project Settings* → *API*: copie a **Project URL** e a chave **anon public**.
2. Na raiz do projeto: `cp .env.example .env` e preencha:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
   A anon key é pública por design: a segurança vem das regras de RLS. O `.env` está no
   `.gitignore`.
3. Reinicie o Expo (`npx expo start -c`) e vá em **Perfil → Conta e sincronização**.

## 6. Testar
- Entre com seu e-mail e o código recebido; o status deve mostrar "Sincronizado em …".
- Em outro aparelho (ou após reinstalar), entre com o mesmo e-mail: os dados aparecem.
- Ligue "Liga com outras pessoas" e veja a **Liga semanal** na aba Metas.
- Testes automáticos do SQL (precisam de Postgres local): `npm run test:sql`.

## Como funciona (resumo)
- **Offline primeiro:** o app continua salvando no aparelho; a nuvem é mesclada a cada
  ação (alguns segundos depois), ao abrir o app e em "Sincronizar agora".
- **Mesclagem:** registros e metas pessoais se juntam por `id` (vence a edição mais recente;
  exclusões não voltam). O progresso do jogo (XP, moedas, sequência, loja) segue o aparelho
  com a ação mais recente, para não duplicar moedas.
- **Primeiro login com dados nos dois lados:** o app pergunta se quer juntar, usar a nuvem
  ou usar o aparelho.
- **Liga:** grupos semanais de até 30 pessoas, só com quem ativou a opção. Aparecem apenas
  apelido e XP da semana. O servidor limita o XP ao máximo que as regras do jogo permitem
  (5.250/semana).
- **Privacidade (LGPD):** cada usuário só acessa os próprios dados (RLS). "Excluir conta"
  apaga a conta e todos os dados da nuvem; os dados do aparelho continuam lá.
