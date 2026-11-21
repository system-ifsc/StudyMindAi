# StudyMind para Android

Aplicativo Android híbrido com WebView, sem barra de navegador, tela de endereço ou página de apresentação. Abre na tela de boas-vindas do aplicativo e, com sessão ativa, diretamente no painel. Requer Android 8+ e backend HTTPS acessível pelo aparelho. A interface ainda é carregada do servidor; não é uma reescrita em componentes nativos nem uma interface empacotada offline.

O servidor continua executando TanStack Start, autenticação, Repo, SQLite e IA opcional. O APK não executa Node nem contém um banco SQLite independente no celular. Sem servidor publicado, não há acesso às contas reais. `localhost` no telefone não aponta para seu computador. Publique seguindo o [README principal](../README.md#backend-local-padrão), com volume persistente e HTTPS.

## Ícone instalado

O APK inclui o cérebro da identidade StudyMind, em traço escuro sobre fundo verde. O ícone é empacotado no aplicativo e aparece no launcher após a instalação, sem depender do carregamento do site. Há recursos adaptativos para Android 8+, ícone redondo e camada monocromática para ícones temáticos no Android 13+; nesse último caso, o sistema escolhe as cores.

Mudanças no ícone exigem gerar e instalar um novo APK. Atualizar somente o site não altera o ícone de um aplicativo já instalado. Para atualizar sem remover o app, use um APK com a mesma assinatura e código de versão superior.

## Gerar APK no GitHub

Envie o projeto ao seu repositório e abra **Actions → Android APK → Run workflow**. Informe a origem HTTPS no campo `server_url`. Para builds de push/PR, configure a variável do repositório `STUDYMIND_SERVER_URL`; sem endereço válido, a compilação falha. O usuário final nunca precisa configurar endereços. O fluxo executa lint Android e gera o artefato **StudyMind-Android-debug**, contendo `app-debug.apk`. Baixe e extraia o ZIP no computador, transfira o APK ao telefone e autorize a instalação por esse aplicativo de arquivos. O fluxo não publica na Play Store.

## Gerar localmente

Requer JDK 17, Android SDK Platform 35, Build Tools e Gradle 8.11.1. Configure `ANDROID_HOME` ou `sdk.dir` no arquivo local `local.properties` (não versionado).

```bash
cd android
gradle -PstudyMindServerUrl=https://estudos.seudominio.com lintDebug assembleDebug
```

O APK fica em `app/build/outputs/apk/debug/app-debug.apk`. Para criar um Gradle Wrapper local com o Gradle instalado, execute `gradle wrapper --gradle-version 8.11.1`. Depois é possível abrir esta pasta no Android Studio e executar no emulador ou celular.

## Escopo e validação no aparelho

A versão 1.0.2 desenha o fundo do aplicativo atrás das barras de status e navegação, inclusive no Android 15, mantendo os controles afastados das barras e dos recortes de tela. A correção é nativa: atualizar o site não altera um APK instalado. Gere e instale o APK 1.0.2 (código de versão 3) para recebê-la; o APK 1.0.1 antigo não contém essa alteração.

O teste instrumentado `SystemBarsTest` verifica a geometria da janela e os pixels das duas barras em uma captura de tela real do emulador. Execute `gradle -PstudyMindServerUrl=https://estudos.seudominio.com connectedDebugAndroidTest` com emulador ou aparelho conectado.

- Login por e-mail/senha, telas existentes, navegação Voltar e seleção de arquivos usam a instalação web. Cookies de sessão permanecem privados no WebView.
- Links de outras origens abrem em aplicativos externos. OAuth Google e recuperação por link externo não têm integração de retorno ao aplicativo nesta versão; use e-mail/senha e o código de recuperação do backend local.
- HTTPS é obrigatório. Nenhuma chave de IA ou credencial de servidor deve entrar no projeto Android.
- Teste cadastro, login, reinício do aplicativo, seleção de PDF, rotação, Voltar, erro de rede e reconexão no aparelho antes de distribuir. Downloads gerados por URLs `blob:` e notificações em segundo plano não têm integração nativa nesta versão.
- Este APK é de desenvolvimento. Distribuição pela Play Store exige assinatura release com chave privada, revisão dos requisitos atuais da loja e testes em dispositivos. Não versione chaves de assinatura.

As versões de build seguem a [compatibilidade do AGP 8.9](https://developer.android.com/build/releases/agp-8-9-0-release-notes). A integração usa as APIs oficiais de [WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview).
