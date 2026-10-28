const { MikroORM } = require('@mikro-orm/postgresql');
const config = require('./mikro-orm.config');

async function bootstrap() {
  try {
    const orm = await MikroORM.init(config);
    const generator = orm.getSchemaGenerator();
    await generator.updateSchema({ wrap: false });
    console.log('✅ Banco de dados sincronizado com sucesso!');
    await orm.close();
  } catch (error) {
    console.error('❌ Erro ao sincronizar banco:', error);
    process.exit(1);
  }
}

bootstrap();