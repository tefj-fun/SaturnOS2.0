

export function createPageUrl(pageName: string) {
    const [path, query] = pageName.split('?');
    const normalizedPath = '/' + path.replace(/ /g, '-');
    return query ? `${normalizedPath}?${query}` : normalizedPath;
}
