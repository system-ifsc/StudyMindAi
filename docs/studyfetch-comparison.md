# Ferramentas educacionais

A plataforma inclui extração de TXT/MD/PDF/DOCX/PPTX, OCR opcional, notas, resumos/guias, flashcards, exercícios fixos e gerados, simulados salvos e tutor com contexto do progresso.

A IA utiliza um provedor configurável compatível com Chat Completions. Configuração, instalação do backend e limites estão no [README](../README.md). As ferramentas com IA exigem autenticação, provedor ativo e cotas; os recursos determinísticos e o banco fixo de exercícios independem de IA.

O texto extraído fica salvo no banco e o original fica em Storage privado. Arquivos de texto têm limite de 1 MB; PDF/DOCX/PPTX de 10 MB; conteúdo extraído de 200 mil caracteres. Chamadas de IA usam até 60 mil caracteres de material salvo ou 15 mil de texto colado. Conteúdo maior é recusado explicitamente.

OCR é local e opcional, com até 20 páginas e download inicial dos idiomas. É necessário conferir a extração. Conversas e tentativas ficam na conta; o backup JSON V1 ainda não inclui esse histórico ou os arquivos originais.
