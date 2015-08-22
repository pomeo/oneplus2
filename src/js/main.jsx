import React from 'react';
/* import App from './App';
   import Home from './Home';
   import Log from './Log';
   import Desc from './Desc'; */
/* import Router, { Route, Link } from 'react-router';
   let DefaultRoute = Router.DefaultRoute;

   let Inbox = React.createClass({
   render: function () {
   return <Link to="log">test</Link>;
   }
   });

   var routes = (
   <Route handler={App}>
   <DefaultRoute handler={Home} />
   <Route name="log" path="logs" handler={Log} />
   <Route name="desc" path="desc" handler={Desc} />
   </Route>
   ); */

/* Router.run(routes, Router.HistoryLocation, (Root) => {
   React.render(<Root/>, document.getElementById("app"));
   }); */

let Hello = React.createClass({
  render: function() {
    return <div>Hello </div>;
  }
});

React.render(<Hello name='World' />, document.getElementById('app'));
