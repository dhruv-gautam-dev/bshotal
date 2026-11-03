// SEO meta tags update hook and page title manager
export const useSeo = (title, description) => {
  if (typeof document !== 'undefined') {
    if (title) document.title = `${title} | B.S. Hotel & Restaurant`;
  }
};

export default useSeo;

