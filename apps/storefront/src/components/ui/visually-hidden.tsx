type VisuallyHiddenProps = React.ComponentProps<"span">;

function VisuallyHidden({ children, ...props }: VisuallyHiddenProps) {
  return (
    <span
      className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]"
      {...props}
    >
      {children}
    </span>
  );
}

export { VisuallyHidden };
export type { VisuallyHiddenProps };
