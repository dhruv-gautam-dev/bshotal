// Responsive image dimensions and breakpoint selection hook
export const useResponsiveImage = (defaultSrc) => {
  return {
    src: defaultSrc || '/placeholder.svg',
    isLoading: false,
  };
};

export default useResponsiveImage;

