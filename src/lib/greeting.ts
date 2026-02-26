export const getTimeGreeting = (name?: string): string => {
  const hour = new Date().getHours();
  const firstName = name?.split(" ")[0] || "";
  let greeting: string;
  
  if (hour < 12) greeting = "Good morning";
  else if (hour < 17) greeting = "Good afternoon";
  else greeting = "Good evening";
  
  return firstName ? `${greeting}, ${firstName} 👋` : `${greeting} 👋`;
};
