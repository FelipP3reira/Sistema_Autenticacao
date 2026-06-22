interface ParametrosErro {
  codigo: string;
  mensagem: string;
  status: number;
  detalhes?: unknown;
}

export class ErroAplicacao extends Error {
  readonly codigo: string;
  readonly status: number;
  readonly detalhes: unknown;

  constructor({ codigo, mensagem, status, detalhes }: ParametrosErro) {
    super(mensagem);
    this.name = new.target.name;
    this.codigo = codigo;
    this.status = status;
    this.detalhes = detalhes;
  }
}

export class ErroValidacao extends ErroAplicacao {
  constructor(mensagem: string, detalhes?: unknown) {
    super({ codigo: 'VALIDACAO', mensagem, status: 400, detalhes });
  }
}

export class ErroNaoAutorizado extends ErroAplicacao {
  constructor(mensagem: string) {
    super({ codigo: 'NAO_AUTORIZADO', mensagem, status: 401 });
  }
}

export class ErroProibido extends ErroAplicacao {
  constructor(mensagem: string) {
    super({ codigo: 'PROIBIDO', mensagem, status: 403 });
  }
}

export class ErroNaoEncontrado extends ErroAplicacao {
  constructor(mensagem: string) {
    super({ codigo: 'NAO_ENCONTRADO', mensagem, status: 404 });
  }
}

export class ErroConflito extends ErroAplicacao {
  constructor(mensagem: string) {
    super({ codigo: 'CONFLITO', mensagem, status: 409 });
  }
}

export class ErroLimiteExcedido extends ErroAplicacao {
  constructor(mensagem: string, detalhes?: unknown) {
    super({ codigo: 'LIMITE_EXCEDIDO', mensagem, status: 429, detalhes });
  }
}
