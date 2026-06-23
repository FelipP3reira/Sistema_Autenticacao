export interface CorpoErro {
  erro: {
    codigo: string;
    mensagem: string;
    detalhes?: unknown;
  };
}

export function montarCorpoErro(codigo: string, mensagem: string, detalhes?: unknown): CorpoErro {
  return {
    erro: {
      codigo,
      mensagem,
      ...(detalhes !== undefined ? { detalhes } : {}),
    },
  };
}
