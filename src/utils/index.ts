

export function createPageUrl(pageName: string) {
    const [path, query] = pageName.split('?');
    const normalizedPath = '/' + path.toLowerCase().replace(/ /g, '-');
    return query ? `${normalizedPath}?${query}` : normalizedPath;
}
