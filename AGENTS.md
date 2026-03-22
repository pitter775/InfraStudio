## Banco de dados
- Nunca editar automaticamente `C:\Projetos\infrastudio\InfraStudio\database\geral-schema.sql`.
- Tratar `C:\Projetos\infrastudio\InfraStudio\database\geral-schema.sql` apenas como documentacao manual e snapshot do banco.
- Toda alteracao real de banco deve ser criada em um arquivo SQL dentro de `C:\Projetos\infrastudio\InfraStudio\database\seeder\`.
- O assistente pode criar arquivos SQL em `C:\Projetos\infrastudio\InfraStudio\database\seeder\`, mas nao deve sincronizar, sobrescrever ou atualizar automaticamente `C:\Projetos\infrastudio\InfraStudio\database\geral-schema.sql`.
- Depois de aplicar mudancas no Supabase, a atualizacao de `C:\Projetos\infrastudio\InfraStudio\database\geral-schema.sql` deve ser feita manualmente pelo usuario.
