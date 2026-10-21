/** Textos em português (Brasil). */

import type { ExportStats, ImportStats } from '../types';
import type { Messages } from './en';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;

export const pt: Messages = {
  categories: {
    all: 'Todos os itens',
    text: 'Textos',
    link: 'Links',
    image: 'Imagens',
    file: 'Arquivos',
    folder: 'Pastas',
  },
  singular: {
    all: 'Item',
    text: 'Texto',
    link: 'Link',
    image: 'Imagem',
    file: 'Arquivo',
    folder: 'Pasta',
  },
  favoritesTitle: {
    all: 'Favoritos',
    text: 'Textos favoritos',
    link: 'Links favoritos',
    image: 'Imagens favoritas',
    file: 'Arquivos favoritos',
    folder: 'Pastas favoritas',
  },

  sidebar: {
    categories: 'Categorias',
    unavailable: 'Captura indisponível',
    unavailableDetail: 'Não foi possível ler a área de transferência',
    recording: 'Gravando',
    waylandNote: 'No Wayland, só apps X11 são gravados',
    itemsSaved: (n: number) => plural(n, 'item salvo', 'itens salvos'),
    paused: 'Pausado',
    pausedDetail: 'Novas cópias não são salvas',
    pause: 'Pausar gravação',
    resume: 'Retomar gravação',
  },

  toolbar: {
    search: 'Buscar no histórico',
    sort: 'Ordem',
    newest: 'Mais recentes',
    oldest: 'Mais antigos',
    nameAsc: 'Nome A–Z',
    nameDesc: 'Nome Z–A',
    view: 'Visualização',
    grid: 'Grade',
    list: 'Lista',
    showAll: 'Mostrar todos os itens',
    showFavorites: 'Mostrar só favoritos',
    settings: 'Configurações',
  },

  time: {
    today: 'Hoje',
    yesterday: 'Ontem',
    justNow: 'Agora',
    minutesAgo: (n: number) => `há ${n} min`,
  },

  history: {
    copied: 'Copiado para a área de transferência',
    copyFailed: (error: string) => `Não foi possível copiar: ${error}`,
    openFailed: (error: string) => `Não foi possível abrir: ${error}`,
    alwaysOpen: 'Arquivos desse tipo vão abrir com este app daqui pra frente',
    desktopRequired: 'Precisa do app para desktop',
    desktopRequiredHint: 'Rode `npm run tauri dev` para ver seu histórico.',
    noMatches: 'Nada encontrado',
    noMatchesHint: 'Tente outras palavras, outra categoria ou desligue o filtro de favoritos.',
    empty: 'Nada copiado ainda',
    emptyHint: 'Copie um texto, um link, uma imagem ou arquivos e eles aparecem aqui.',
    bringBack: 'Chame o ClipVault de qualquer lugar com',
  },

  item: {
    favorite: 'Favorito',
    image: 'Imagem',
    imageSized: (size: string) => `Imagem, ${size}`,
    files: (n: number) => `${n} arquivos`,
    preview: (kind: string) => `Prévia: ${kind}`,
    copy: 'Copiar',
    addFavorite: 'Adicionar aos favoritos',
    removeFavorite: 'Remover dos favoritos',
    addTag: 'Adicionar etiqueta',
    newTag: 'Nova etiqueta',
    tagName: 'Nome da etiqueta',
    removeTag: 'Remover etiqueta',
    removeTagNamed: (tag: string) => `Remover etiqueta ${tag}`,
    openPreview: 'Abrir prévia',
    delete: 'Apagar',
    close: 'Fechar',
  },

  files: {
    savedCopyOnly: 'Só a cópia salva',
    notFound: 'Não encontrado',
    savedCopy: 'Cópia salva',
    saving: 'Salvando…',
    pathOnly: 'Só o caminho',
    missing: 'Ausente',
    open: (name: string) => `Abrir ${name}`,
    more: (n: number) => `mais ${n}`,
  },

  openWith: {
    title: 'Abrir com',
    label: (name: string) => `Abrir ${name} com`,
    noApps: 'Nenhum app instalado abre esse tipo de arquivo. Instale um e tente de novo.',
    apps: 'Apps',
    default: 'Padrão',
    justOnce: 'Só desta vez',
    always: 'Sempre',
  },

  settings: {
    title: 'Configurações',
    saveFailed: (error: string) => `Não foi possível salvar as configurações: ${error}`,
    appearance: 'Aparência',
    theme: 'Tema',
    light: 'Claro',
    dark: 'Escuro',
    accent: 'Cor de destaque',
    accentNames: [
      'Roxo profundo',
      'Azul elétrico',
      'Verde esmeralda',
      'Laranja pôr do sol',
      'Vermelho rubi',
      'Rosa choque',
      'Índigo',
      'Verde-azulado',
      'Âmbar',
      'Rosa',
      'Ciano',
      'Violeta',
    ],
    language: 'Idioma',
    languageHint: 'Vale também para o menu da bandeja e as notificações.',
    languageAuto: 'Automático',
    hardware: 'Aceleração de hardware',
    hardwareHint:
      'Desligue se textos ou imagens aparecerem com ruído ou distorcidos, como em placas de vídeo integradas mais antigas. Vale depois de reiniciar o ClipVault.',
    clipboard: 'Área de transferência',
    record: 'Gravar área de transferência',
    recordHint: 'Salva tudo o que você copia. Também na barra lateral.',
    keep: 'Itens a manter',
    keepHint: 'Diminuir remove os itens mais antigos. Favoritos são sempre mantidos.',
    notify: 'Avisar sobre novos itens',
    notifyHint: 'Uma notificação para cada cópia enquanto o ClipVault está oculto.',
    files: 'Arquivos',
    snapshots: 'Salvar cópias de arquivos até (MB)',
    snapshotsHint:
      'Arquivos copiados são salvos no cofre em segundo plano quando a cópia inteira cabe nesse limite, para colar mesmo depois de movidos ou apagados. 0 guarda só os caminhos.',
    alwaysApps: 'Apps escolhidos com "Sempre"',
    alwaysAppsNone: 'Nenhum ainda. Ao abrir um arquivo você escolhe o app só desta vez ou sempre.',
    alwaysAppsSome: (types: string[]) => `Abrem direto: ${types.join(', ')}`,
    reset: 'Redefinir',
    startup: 'Inicialização',
    startOnLogin: 'Iniciar com o sistema',
    startOnLoginHint: 'Abre o ClipVault oculto na bandeja quando você entra na sessão.',
    tray: 'Continuar na bandeja',
    trayHint: 'Fechar a janela mantém a gravação. Saia pelo menu da bandeja.',
    backup: 'Backup',
    backupRow: 'Backup do histórico',
    backupHint:
      'Um .zip com textos, imagens, cópias de arquivos, etiquetas e favoritos. Importar soma ao histórico atual e não substitui nada.',
    export: 'Exportar…',
    import: 'Importar…',
    exporting: 'Exportando…',
    importing: 'Importando…',
    exported: (s: ExportStats) =>
      `${plural(s.items, 'item salvo', 'itens salvos')} e ${plural(s.files, 'arquivo', 'arquivos')} (${formatBytes(s.bytes)}).`,
    imported: (s: ImportStats, maxItems: number) => {
      let message = `${plural(s.added, 'item novo adicionado', 'itens novos adicionados')}`;
      if (s.merged) message += `; ${s.merged} já estavam no histórico (etiquetas e favoritos combinados)`;
      message += '.';
      if (s.skipped) message += ` ${plural(s.skipped, 'entrada danificada ignorada', 'entradas danificadas ignoradas')}.`;
      if (s.pruned) {
        message += ` ${plural(s.pruned, 'item mais antigo removido', 'itens mais antigos removidos')} para ficar no limite de ${maxItems}. Aumente "Itens a manter" antes para guardar tudo.`;
      }
      return message;
    },
    shortcuts: 'Atalhos de teclado',
    toggleApp: 'Mostrar ou ocultar o ClipVault',
    toggleAppHint: 'Funciona em qualquer app. Backspace desativa.',
    copySelected: 'Copiar item selecionado',
    copySelectedHint: 'Copia e oculta o ClipVault para você colar. As setas selecionam.',
    deleteSelected: 'Apagar item selecionado',
    pressKeys: 'Pressione uma combinação de teclas…',
    disabled: 'Desativado',
  },
};
