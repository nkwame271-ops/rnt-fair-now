export const getTimeGreeting = (name?: string): string => {
  const firstName = name?.split(" ")[0] || "";
  return firstName ? `Hello, ${firstName} 👋` : `Hello 👋`;
};
