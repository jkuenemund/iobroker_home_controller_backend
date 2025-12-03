import React from "react";

const App: React.FC<any> = (props) => {
	return (
		<div style={{ padding: 20 }}>
			<h1>Hello World</h1>
			<p>React is running!</p>
			<p>Adapter: {props.adapterName}</p>
		</div>
	);
};

export default App;
